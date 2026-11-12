// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title MintCaller — LOCAL TEST HELPER ONLY
/// @notice A plain contract that forwards a mint() call, used ONLY to prove
///         the EOA-only gate (msg.sender == tx.origin) reverts for contract
///         callers. Never deploy on testnet/mainnet; not part of AuraAgents.
interface IAura {
    function mint(uint256 qty) external payable;
}

contract MintCaller {
    IAura public immutable aura;

    constructor(address aura_) {
        aura = IAura(aura_);
    }

    function callMint(uint256 qty) external payable {
        aura.mint{value: msg.value}(qty);
    }
}
