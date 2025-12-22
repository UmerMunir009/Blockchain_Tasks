export const CONTRACT_ADDRESS = "0x4EC2755e70a8E68fa7526A02c19dA0561D545cED";

export const CONTRACT_ABI = [
  {
    "type": "constructor",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "_v2Router",  "type": "address", "internalType": "address" },
      { "name": "_v3Router",  "type": "address", "internalType": "address" },
      { "name": "_weth",      "type": "address", "internalType": "address" },
      { "name": "_v2Factory", "type": "address", "internalType": "address" },
      { "name": "_v3Factory", "type": "address", "internalType": "address" }
    ]
  },

  /* ───────────── Errors ───────────── */
  { "type": "error", "name": "EnforcedPause", "inputs": [] },
  { "type": "error", "name": "ExpectedPause", "inputs": [] },

  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [{ "name": "owner", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },

  {
    "type": "error",
    "name": "PoolDoesNotExistV2",
    "inputs": [
      { "name": "tokenIn",  "type": "address", "internalType": "address" },
      { "name": "tokenOut", "type": "address", "internalType": "address" }
    ]
  },
  {
    "type": "error",
    "name": "PoolDoesNotExistV3",
    "inputs": [
      { "name": "tokenIn",  "type": "address", "internalType": "address" },
      { "name": "tokenOut", "type": "address", "internalType": "address" },
      { "name": "fee",      "type": "uint24",  "internalType": "uint24" }
    ]
  },

  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },

  /* ───────────── Events ───────────── */
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "name": "previousOwner", "type": "address" },
      { "indexed": true,  "name": "newOwner",      "type": "address" }
    ]
  },
  {
    "type": "event",
    "name": "Paused",
    "anonymous": false,
    "inputs": [
      { "indexed": false, "name": "account", "type": "address" }
    ]
  },
  {
    "type": "event",
    "name": "Unpaused",
    "anonymous": false,
    "inputs": [
      { "indexed": false, "name": "account", "type": "address" }
    ]
  },
  {
    "type": "event",
    "name": "SwapExecuted",
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "name": "user",      "type": "address" },
      { "indexed": true,  "name": "tokenIn",   "type": "address" },
      { "indexed": true,  "name": "tokenOut",  "type": "address" },
      { "indexed": false, "name": "amountIn",  "type": "uint256" },
      { "indexed": false, "name": "amountOut", "type": "uint256" },
      { "indexed": false, "name": "dex",       "type": "uint8" }
    ]
  },

  /* ───────────── View Functions ───────────── */
  {
    "type": "function",
    "name": "DEADLINE_BUFFER",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "uint256" }]
  },
  {
    "type": "function",
    "name": "WETH",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "address" }]
  },
  {
    "type": "function",
    "name": "owner",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "address" }]
  },
  {
    "type": "function",
    "name": "paused",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "bool" }]
  },

  /* ───────────── State-Changing Functions ───────────── */
  {
    "type": "function",
    "name": "swap",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "tokenIn",  "type": "address" },
      { "name": "tokenOut", "type": "address" },
      { "name": "amountIn", "type": "uint256" },
      { "name": "version",  "type": "uint8" },
      { "name": "poolFee",  "type": "uint24" }
    ],
    "outputs": [
      { "name": "amountOut", "type": "uint256" }
    ]
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "stateMutability": "nonpayable",
    "inputs": [],
    "outputs": []
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "newOwner", "type": "address" }
    ],
    "outputs": []
  },

  /* ───────────── Router / Factory Getters ───────────── */
  {
    "type": "function",
    "name": "v2Router",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "address" }]
  },
  {
    "type": "function",
    "name": "v3Router",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "address" }]
  },
  {
    "type": "function",
    "name": "v2Factory",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "address" }]
  },
  {
    "type": "function",
    "name": "v3Factory",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "type": "address" }]
  }
]


//need the basic ERC20 ABI to handle "Approve" transactions
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)"
];

