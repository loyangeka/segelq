// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SegelQ — Quantum-Sealed Prediction Receipts
/// @notice Seal the hash of a short prediction (or any short text) on
///         QoreChain. The sealing account authorises its EVM transactions
///         through a hybrid post-quantum window (secp256k1 + ML-DSA-87,
///         NIST FIPS 204), so every seal is anchored to a quantum-resistant
///         signature that the validators verified on chain
///         (see the `pqc_hybrid_verify` event of the window-open
///         transaction). The plaintext never goes on chain — only its hash,
///         a public label, the sealer and the timestamp.
/// @dev Deliberately minimal: an append-only receipt registry.
contract SegelQ {
    struct Seal {
        address sealer; // account that sealed the text
        bytes32 textHash; // keccak256 (or sha256) hash of the sealed text
        string label; // short public label, e.g. "BTC above 100k by 2027"
        uint256 sealedAt; // block timestamp of the seal
        uint256 blockNumber; // block the seal landed in
    }

    Seal[] private _seals;

    /// @notice textHash => first seal id + 1 (0 means "not sealed yet").
    mapping(bytes32 => uint256) public firstSealByHash;

    /// @notice sealer => list of their seal ids.
    mapping(address => uint256[]) private _sealIdsBySealer;

    event Sealed(
        uint256 indexed sealId,
        address indexed sealer,
        bytes32 indexed textHash,
        string label,
        uint256 sealedAt
    );

    error EmptyLabel();

    /// @notice Seal a text hash with a public label.
    /// @param textHash sha256 of the prediction text (computed off chain).
    /// @param label short public label for the receipt.
    /// @return sealId the id of the new seal (its index in the registry).
    function seal(bytes32 textHash, string calldata label) external returns (uint256 sealId) {
        if (bytes(label).length == 0) revert EmptyLabel();

        sealId = _seals.length;
        _seals.push(
            Seal({
                sealer: msg.sender,
                textHash: textHash,
                label: label,
                sealedAt: block.timestamp,
                blockNumber: block.number
            })
        );
        _sealIdsBySealer[msg.sender].push(sealId);
        if (firstSealByHash[textHash] == 0) {
            firstSealByHash[textHash] = sealId + 1;
        }

        emit Sealed(sealId, msg.sender, textHash, label, block.timestamp);
    }

    /// @notice Total number of seals in the registry.
    function sealCount() external view returns (uint256) {
        return _seals.length;
    }

    /// @notice Read one seal back by id.
    function getSeal(uint256 sealId) external view returns (Seal memory) {
        return _seals[sealId];
    }

    /// @notice All seal ids created by one account.
    function sealsOf(address sealer) external view returns (uint256[] memory) {
        return _sealIdsBySealer[sealer];
    }

    /// @notice Has this exact text hash ever been sealed?
    function isSealed(bytes32 textHash) external view returns (bool) {
        return firstSealByHash[textHash] != 0;
    }
}
