import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  Wallet,
  ArrowDown,
  Settings,
  RefreshCw,
  ChevronDown,
  User,
  Activity,
  CreditCard,
  AlertCircle
} from "lucide-react";
import { CONTRACT_ABI, CONTRACT_ADDRESS, ERC20_ABI } from "./assets/constants";
const TOKENS = [
  { symbol: "WETH", name: "Wrapped ETH", address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" },
  { symbol: "USDC", name: "USD Coin", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  { symbol: "DAI", name: "Dai Stablecoin", address: "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6" }
];

const App = () => {
  const [account, setAccount] = useState("");
  const [tokenIn, setTokenIn] = useState(TOKENS[0].address);
  const [tokenOut, setTokenOut] = useState(TOKENS[1].address);
  const [amount, setAmount] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [dexVersion, setDexVersion] = useState(1);
  const [poolFee, setPoolFee] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState("0.0");
  const [ethBalance, setEthBalance] = useState("0.0");

  const isSameToken = tokenIn.toLowerCase() === tokenOut.toLowerCase();

  const feeTiers = [
    { label: "0.01% (Stable)", value: 100 },
    { label: "0.05% (Common)", value: 500 },
    { label: "0.3% (Standard)", value: 3000 },
    { label: "1.0% (Exotic)", value: 10000 },
  ];

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const b = await provider.getBalance(accounts[0]);
        setEthBalance(ethers.formatEther(b));
        setAccount(accounts[0]);
        toast.success("Wallet connected!");
      } catch (err) {
        toast.error("Failed to connect wallet.");
      }
    } else {
      toast.warning("Please install Metamask.");
    }
  };

  useEffect(() => {
    const getBalance = async () => {
      if (account && ethers.isAddress(tokenIn)) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, provider);
          const decimals = await tokenContract.decimals();
          const b = await tokenContract.balanceOf(account);
          setBalance(ethers.formatUnits(b, decimals));
        } catch (e) {
          setBalance("0.0");
        }
      }
    };
    getBalance();
  }, [account, tokenIn]);

  useEffect(() => {
    if (amount && !isNaN(amount) && Number(amount) > 0 && !isSameToken) {
      const simulatedOutput = (Number(amount) * 0.995).toFixed(6); //fix
      setAmountOut(simulatedOutput);
    } else {
      setAmountOut("");
    }
  }, [amount, isSameToken]);

  const handleSwap = async () => {
    if (!account || isSameToken) return;

    setLoading(true);
    const toastId = toast.loading("Processing transaction...");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tIn = new ethers.Contract(tokenIn, ERC20_ABI, signer);
      const swapper = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const decimals = await tIn.decimals();
      const parsedAmount = ethers.parseUnits(amount, decimals);

      toast.update(toastId, { render: "Approving token usage..." });
      const appTx = await tIn.approve(CONTRACT_ADDRESS, parsedAmount);
      await appTx.wait();

      toast.update(toastId, { render: "Executing swap..." });
      const swapTx = await swapper.swap(
        tokenIn,
        tokenOut,
        parsedAmount,
        dexVersion,
        poolFee,
        { gasLimit: 500000 }
      );

      const receipt = await swapTx.wait();
      toast.update(toastId, {
        render: `Success! Hash: ${receipt.hash.slice(0, 10)}...`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });

    } catch (err) {
      console.error("Full Error Object:", err);
      const errorData = err.data || (err.error && err.error.data);

      if (errorData) {
        try {
          const swapper = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI);
          const decodedError = swapper.interface.parseError(errorData);

          if (decodedError.name === "PoolDoesNotExistV3") {
            toast.update(toastId, {
              render: `Uniswap V3 Error: No pool exists for this pair at the ${poolFee / 10000}% fee tier.`,
              type: "error",
              isLoading: false,
              autoClose: 5000,
            });
          } else if (decodedError.name === "PoolDoesNotExistV2") {
            toast.update(toastId, {
              render: `Uniswap V2 Error: No direct or WETH-hop pool exists for this pair.`,
              type: "error",
              isLoading: false,
              autoClose: 5000,
            });
          } else {
            toast.update(toastId, {
              render: `Contract Reverted: ${decodedError.name}`,
              type: "error",
              isLoading: false,
              autoClose: 5000,
            });
          }
          return;
        } catch (decodeErr) {
          console.log("Could not decode error:", decodeErr);
        }
      }
      toast.update(toastId, {
        render: `Reverted due to non-existance of pool`,
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white font-sans">
      <ToastContainer position="top-right" theme="dark" />

      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/10 blur-[120px] rounded-full" />
      </div>

      <nav className="flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center">
            <RefreshCw className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">Multi-Hop <span className="text-cyan-400">Swapper</span></span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto pt-12 px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <User className="text-cyan-400" size={24} /> Wallet Profile
            </h2>

            {!account ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-6">Connect your wallet to view balance and execute swaps.</p>
                <button
                  onClick={connectWallet}
                  className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 border border-white/10 py-4 rounded-2xl transition-all shadow-lg active:scale-95"
                >
                  <Wallet size={20} className="text-cyan-400" />
                  Connect Metamask
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                  <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Address</span>
                  <p className="text-sm font-mono truncate text-cyan-200">{account}</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl"><Activity className="text-blue-400" size={20} /></div>
                    <div>
                      <span className="text-xs text-gray-500 block">Network</span>
                      <span className="font-semibold text-sm">Sepolia Testnet</span>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl"><CreditCard className="text-purple-400" size={20} /></div>
                    <div>
                      <span className="text-xs text-gray-500 block">ETH Balance</span>
                      <span className="font-semibold text-lg">{parseFloat(ethBalance).toFixed(4)} ETH</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl relative">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold">Exchange Tokens</h2>
              <Settings size={20} className="text-gray-400 hover:text-white cursor-pointer transition-colors" />
            </div>

            <div className="space-y-3">
              <div className={`bg-white/5 border rounded-2xl p-6 transition-all ${isSameToken ? 'border-red-500/50' : 'border-white/5 hover:border-white/10'}`}>
                <div className="flex justify-between text-sm text-gray-400 mb-4">
                  <span>You pay</span>
                  <span className="text-cyan-400 font-medium font-mono">Bal: {balance}</span>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <input
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-4xl font-semibold outline-none w-full placeholder:text-gray-700"
                  />
                  <select
                    value={tokenIn}
                    onChange={(e) => setTokenIn(e.target.value)}
                    className="bg-white/10 rounded-xl px-4 py-2 text-lg font-bold outline-none w-full md:w-48 border border-white/10 focus:border-cyan-500 cursor-pointer"
                  >
                    {TOKENS.map((token) => (
                      <option key={token.address} value={token.address} className="bg-[#1a1529]">
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-center -my-6 relative z-10">
                <div
                  onClick={() => {
                    const temp = tokenIn;
                    setTokenIn(tokenOut);
                    setTokenOut(temp);
                  }}
                  className="bg-[#1a1529] border border-white/10 p-3 rounded-2xl hover:text-cyan-400 cursor-pointer shadow-2xl active:scale-90 transition-all"
                >
                  <ArrowDown size={24} />
                </div>
              </div>

              <div className={`bg-white/5 border rounded-2xl p-6 transition-all ${isSameToken ? 'border-red-500/50' : 'border-white/5 hover:border-white/10'}`}>
                <div className="flex justify-between text-sm text-gray-400 mb-4">
                  <span>You receive (estimated)</span>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <input
                    type="text"
                    readOnly
                    value={isSameToken ? "" : amountOut}
                    placeholder="0.0"
                    className="bg-transparent text-4xl font-semibold outline-none w-full text-gray-400"
                  />
                  <select
                    value={tokenOut}
                    onChange={(e) => setTokenOut(e.target.value)}
                    className="bg-white/10 rounded-xl px-4 py-2 text-lg font-bold outline-none w-full md:w-48 border border-white/10 focus:border-cyan-500 cursor-pointer"
                  >
                    {TOKENS.map((token) => (
                      <option key={token.address} value={token.address} className="bg-[#1a1529]">
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {isSameToken && (
              <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 animate-pulse">
                <AlertCircle size={18} />
                <span className="text-sm font-medium">Cannot swap the same token. Please select a different pair.</span>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                <button onClick={() => setDexVersion(0)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${dexVersion === 0 ? "bg-white/10 text-cyan-400 shadow-sm" : "text-gray-500"}`}>Uniswap V2</button>
                <button onClick={() => setDexVersion(1)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${dexVersion === 1 ? "bg-white/10 text-cyan-400 shadow-sm" : "text-gray-500"}`}>Uniswap V3</button>
              </div>

              {dexVersion === 1 && (
                <div className="relative">
                  <select
                    value={poolFee}
                    onChange={(e) => setPoolFee(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm appearance-none outline-none cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    {feeTiers.map((tier) => (
                      <option key={tier.value} value={tier.value} className="bg-[#1a1529]">{tier.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>

            <button
              onClick={handleSwap}
              disabled={!account || loading || !amount || isSameToken}
              className={`w-full mt-8 py-5 rounded-[20px] font-bold text-xl transition-all shadow-lg ${
                (!account || !amount || isSameToken)
                  ? "bg-white/5 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-[0.98] shadow-cyan-500/20"
              }`}
            >
              {account ? (
                isSameToken ? "Invalid Pair" : loading ? "Processing Transaction..." : "Swap Assets"
              ) : "Connect Wallet to Swap"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;