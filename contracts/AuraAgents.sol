// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IAgentIdRegistry {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title Aura Agents — QUIRKZ model, new theme (16 pixel auras)
/// @notice Binance Agent ID NFT mint, modelled on the proven Agent Harvest
///         Land / NFOX pattern (ERC721 + Ownable + ReentrancyGuard,
///         registry address passed in the constructor,
///         balanceOf(wallet) > 0 = has Agent ID).
///         Supply: 8,000 total = 7,200 FREE + 800 PAID.
///         SINGLE BLENDED mint(qty): first 2 per wallet FREE, every extra
///         in the same tx paid at 0.0005 BNB (~$0.35 at $700/BNB).
///         No separate paid phase. Max 10 per wallet total.
///         Agent ID required for ALL mints (free + paid).
///         EOA-only: msg.sender == tx.origin.
///         Paid price math: $0.35 / $700 = 0.0005 BNB exactly.
///         Max paid revenue: 800 x $0.35 = $280 (0.4 BNB).
///         5% ERC-2981 royalties (500 bps) to the owner.
///         Pot/referral split (30% pot / 20% referral / ~50% owner) is an
///         OFF-CHAIN distribution from actual withdrawn revenue — there is
///         no on-chain raffle or referrer payout in this contract (see
///         SPECS.md Gate 0 decision). No allowlist, no oracle, no extra
///         signatures. Not audited by a third party.
///         Mainnet registry: 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
///         Testnet: deploy AgentIdRegistryMock first and pass its address.
contract AuraAgents is ERC721, ERC721Royalty, Ownable, ReentrancyGuard {
    IAgentIdRegistry public immutable agentIdRegistry;

    uint256 public constant MAX_SUPPLY = 8000;
    uint256 public constant FREE_SUPPLY = 7200;
    uint256 public constant PAID_SUPPLY = MAX_SUPPLY - FREE_SUPPLY; // 800
    uint256 public constant PAID_PRICE = 0.0005 ether; // ~$0.35 at $700/BNB
    uint256 public constant MAX_PER_WALLET = 10;
    uint256 public constant FREE_PER_WALLET = 2;

    /// @notice Free mints used per wallet (0..2).
    mapping(address => uint256) public freeMinted;
    /// @notice Total mints per wallet, free + paid (0..10).
    mapping(address => uint256) public mintedCount;

    uint256 public paidMinted;
    uint256 private _freeCount;
    uint256 private _nextId = 1;

    string private _base;

    event FreeMinted(address indexed to, uint256 indexed tokenId);
    event PaidMinted(address indexed to, uint256 indexed tokenId);
    event BnbWithdrawn(address indexed to, uint256 amount);

    constructor(address agentIdRegistry_, address initialOwner)
        ERC721("Aura Agents", "AURA")
        Ownable(initialOwner)
    {
        require(agentIdRegistry_ != address(0), "zero registry");
        agentIdRegistry = IAgentIdRegistry(agentIdRegistry_);
        // 5% ERC-2981 default royalty to the owner (500 / 10000 bps).
        _setDefaultRoyalty(initialOwner, 500);
    }

    /// @notice ERC-2981 + ERC-721 interface support (required override).
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ------------------------------------------------------------- metadata
    function setBaseURI(string calldata uri) external onlyOwner {
        _base = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    /// @notice Per-VARIANT tokenURI (file-count reduction, 2026-11-02):
    ///         tokenURI(tokenId) = baseURI + variant, where
    ///         variant = (tokenId - 1) % 16 + 1 (1..16). All 500 tokens of
    ///         a variant share ONE metadata file (metadata/1 .. metadata/16)
    ///         — there are no per-token traits, so per-token metadata files
    ///         (8,000 of them) carried no information. Reverts for
    ///         nonexistent tokens, same as ERC721.tokenURI.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 variant = (tokenId - 1) % 16 + 1;
        return string.concat(_baseURI(), Strings.toString(variant));
    }

    // ----------------------------------------------------------------- views
    function totalSupply() public view returns (uint256) {
        return _nextId - 1;
    }

    /// @notice Number of free mints used so far (0..7200).
    function freeMintedCount() public view returns (uint256) {
        return _freeCount;
    }

    function freeRemaining() public view returns (uint256) {
        return FREE_SUPPLY - _freeCount;
    }

    function paidRemaining() public view returns (uint256) {
        return PAID_SUPPLY - paidMinted;
    }

    function freeOpen() public view returns (bool) {
        return _freeCount < FREE_SUPPLY;
    }

    /// @notice Paid is open from the start for qty beyond a wallet's free
    ///         allowance — there is NO separate paid phase in this contract.
    ///         Deliberate deviation from NFOX/AKEY (paidOpen waited for
    ///         free exhaustion there).
    function paidOpen() public view returns (bool) {
        return paidMinted < PAID_SUPPLY && totalSupply() < MAX_SUPPLY;
    }

    /// @notice Blended quote for a wallet: (freeQty, paidQty, exact value).
    ///         freeQty = min(qty, wallet free allowance left, free left globally).
    function quoteMint(address wallet, uint256 qty)
        public
        view
        returns (uint256 freeQty, uint256 paidQty, uint256 value)
    {
        uint256 walletFreeLeft = FREE_PER_WALLET - freeMinted[wallet];
        uint256 freeLeft = FREE_SUPPLY - _freeCount;
        freeQty = qty;
        if (freeQty > walletFreeLeft) freeQty = walletFreeLeft;
        if (freeQty > freeLeft) freeQty = freeLeft;
        paidQty = qty - freeQty;
        value = PAID_PRICE * paidQty;
    }

    // ------------------------------------------------------------ blended mint
    /// @notice Blended mint: first 2 per wallet FREE, every extra in the
    ///         same tx paid at exactly 0.0005 BNB each. Agent ID holders
    ///         only, EOA only, max 10 per wallet total, exact payment.
    function mint(uint256 qty) external payable nonReentrant {
        require(msg.sender == tx.origin, "EOA only");
        require(qty > 0 && qty <= MAX_PER_WALLET, "qty 1..10");
        require(mintedCount[msg.sender] + qty <= MAX_PER_WALLET, "max 10 per wallet");
        require(agentIdRegistry.balanceOf(msg.sender) > 0, "no Agent ID");
        require(totalSupply() + qty <= MAX_SUPPLY, "exceeds max supply");

        (uint256 freeQty, uint256 paidQty, uint256 value) = quoteMint(msg.sender, qty);
        require(paidMinted + paidQty <= PAID_SUPPLY, "paid supply exhausted");
        require(msg.value == value, "wrong price");

        // Effects before interactions (checks-effects-interactions).
        freeMinted[msg.sender] += freeQty;
        mintedCount[msg.sender] += qty;
        _freeCount += freeQty;
        paidMinted += paidQty;

        for (uint256 i = 0; i < qty; i++) {
            uint256 tokenId = _nextId++;
            _safeMint(msg.sender, tokenId);
            if (i < freeQty) {
                emit FreeMinted(msg.sender, tokenId);
            } else {
                emit PaidMinted(msg.sender, tokenId);
            }
        }
    }

    /// @notice Radar-compatibility wrapper: exactly mint(1) through the
    ///         same blended logic. NOT a separate free path — if the wallet
    ///         already used its 2 free, this costs 0.0005 BNB.
    function freeMint() external payable nonReentrant {
        require(msg.sender == tx.origin, "EOA only");
        require(mintedCount[msg.sender] + 1 <= MAX_PER_WALLET, "max 10 per wallet");
        require(agentIdRegistry.balanceOf(msg.sender) > 0, "no Agent ID");
        require(totalSupply() + 1 <= MAX_SUPPLY, "exceeds max supply");

        (uint256 freeQty, uint256 paidQty, uint256 value) = quoteMint(msg.sender, 1);
        require(paidMinted + paidQty <= PAID_SUPPLY, "paid supply exhausted");
        require(msg.value == value, "wrong price");

        freeMinted[msg.sender] += freeQty;
        mintedCount[msg.sender] += 1;
        _freeCount += freeQty;
        paidMinted += paidQty;

        uint256 tokenId = _nextId++;
        _safeMint(msg.sender, tokenId);
        if (freeQty == 1) {
            emit FreeMinted(msg.sender, tokenId);
        } else {
            emit PaidMinted(msg.sender, tokenId);
        }
    }

    // ----------------------------------------------------------------- BNB
    /// @notice Withdraw BNB revenue (paid mints). Only way BNB leaves.
    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "nothing to withdraw");
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "BNB send failed");
        emit BnbWithdrawn(owner(), amount);
    }

    receive() external payable {}
}
