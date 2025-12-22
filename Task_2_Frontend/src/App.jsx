import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  POOL_ABI,
  ERC20_ABI,
  MY_TOKEN_ADDRESS,
  USDC_ADDRESS,
} from "../src/assets/constants";
import {
  LayoutGrid,
  RefreshCw,
  Wallet,
  TrendingUp,
  Coins,
  PlusCircle,
  ChevronDown,
  ArrowDownUp,
  Gift
} from "lucide-react";

const SUPPORTED_TOKENS = [
  { symbol: "USDC", address: USDC_ADDRESS },
  { symbol: "WETH", address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" },
  { symbol: "DAI", address: "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6" },
];

function App() {
  const [account, setAccount] = useState(null);
  const [activeTab, setActiveTab] = useState("swap");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Token Configuration
  const [tokenA] = useState(MY_TOKEN_ADDRESS);
  const [tokenB, setTokenB] = useState(USDC_ADDRESS);
  const [isReversed, setIsReversed] = useState(false); // false: B -> A, true: A -> B
  
  const [poolAddress, setPoolAddress] = useState("");
  const [symbols, setSymbols] = useState({ a: "CTK", b: "USDC" });
  const [decimals, setDecimals] = useState({ a: 18, b: 18 });
  const [balances, setBalances] = useState({ a: "0", b: "0" });

  const [poolStats, setPoolStats] = useState({
    resA: "0",
    resB: "0",
    myShares: "0",
    totalShares: "0",
  });

  const [swapAmount, setSwapAmount] = useState("");
  const [stakeAmountA, setStakeAmountA] = useState("");
  const [stakeAmountB, setStakeAmountB] = useState("");
  const [removeAmount, setRemoveAmount] = useState("");

  useEffect(() => {
    if (account) fetchBlockchainData();
  }, [account, tokenB]);

  const connectWallet = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    }
  };

  const fetchBlockchainData = async () => {
    if (!account || !window.ethereum || !tokenA || !tokenB) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const cleanA = ethers.getAddress(tokenA);
      const cleanB = ethers.getAddress(tokenB);

      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const discoveredAddress = await factory.getPool(cleanA, cleanB);

      const contractA = new ethers.Contract(cleanA, ERC20_ABI, provider);
      const contractB = new ethers.Contract(cleanB, ERC20_ABI, provider);

      const metadata = await Promise.allSettled([
        contractA.symbol(), contractB.symbol(),
        contractA.decimals(), contractB.decimals(),
        contractA.balanceOf(account), contractB.balanceOf(account),
      ]);

      const symA = metadata[0].status === "fulfilled" ? metadata[0].value : "CTK";
      const symB = metadata[1].status === "fulfilled" ? metadata[1].value : "TKN2";
      const decA = metadata[2].status === "fulfilled" ? Number(metadata[2].value) : 18;
      const decB = metadata[3].status === "fulfilled" ? Number(metadata[3].value) : 18;
      const balA = metadata[4].status === "fulfilled" ? metadata[4].value : 0n;
      const balB = metadata[5].status === "fulfilled" ? metadata[5].value : 0n;

      setSymbols({ a: symA, b: symB });
      setDecimals({ a: decA, b: decB });
      setBalances({
        a: ethers.formatUnits(balA, decA),
        b: ethers.formatUnits(balB, decB),
      });

      if (discoveredAddress && discoveredAddress !== ethers.ZeroAddress) {
        setPoolAddress(discoveredAddress);
        const pool = new ethers.Contract(discoveredAddress, POOL_ABI, provider);

        const [r0, r1, shares, ts, poolT0] = await Promise.all([
          pool.reserve0(), pool.reserve1(),
          pool.liquidityShares(account), pool.totalShares(),
          pool.token0(),
        ]);

        const isA_Token0 = ethers.getAddress(poolT0) === cleanA;

        setPoolStats({
          resA: ethers.formatUnits(isA_Token0 ? r0 : r1, decA),
          resB: ethers.formatUnits(isA_Token0 ? r1 : r0, decB),
          myShares: ethers.formatUnits(shares, 18),
          totalShares: ethers.formatUnits(ts, 18),
        });
      } else {
        setPoolAddress("");
        setPoolStats({ resA: "0", resB: "0", myShares: "0", totalShares: "0" });
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  // --- SWAP LOGIC ---
  const getAmountOut = () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) return "0";
    const resIn = isReversed ? parseFloat(poolStats.resA) : parseFloat(poolStats.resB);
    const resOut = isReversed ? parseFloat(poolStats.resB) : parseFloat(poolStats.resA);
    
    if (resIn <= 0 || resOut <= 0) return "0";

    const amountInWithFee = parseFloat(swapAmount) * 0.997;
    const numerator = amountInWithFee * resOut;
    const denominator = resIn + amountInWithFee;
    return (numerator / denominator).toFixed(6);
  };

  const handleSwap = async () => {
    if (!swapAmount || !poolAddress) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const currentTokenIn = isReversed ? tokenA : tokenB;
      const decIn = isReversed ? decimals.a : decimals.b;
      const symIn = isReversed ? symbols.a : symbols.b;

      const tokenContract = new ethers.Contract(currentTokenIn, ERC20_ABI, signer);
      const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
      const amountParsed = ethers.parseUnits(swapAmount, decIn);

      setStatus(`Approving ${symIn}...`);
      const appTx = await tokenContract.approve(poolAddress, amountParsed);
      await appTx.wait();

      setStatus(`Swapping ${symIn}...`);
      const tx = await pool.swap(currentTokenIn, amountParsed, { gasLimit: 300000 });
      await tx.wait();

      setStatus("Swap Successful!");
      setSwapAmount("");
      fetchBlockchainData();
    } catch (err) {
      setStatus("Swap Failed: " + (err.reason || "Error"));
    }
    setLoading(false);
  };

  const handleStake = async () => {
    if (!stakeAmountA || !stakeAmountB || !poolAddress) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
      const contractA = new ethers.Contract(tokenA, ERC20_ABI, signer);
      const contractB = new ethers.Contract(tokenB, ERC20_ABI, signer);
      
      const valA = ethers.parseUnits(stakeAmountA, decimals.a);
      const valB = ethers.parseUnits(stakeAmountB, decimals.b);

      setStatus(`Approving Tokens...`);
      await (await contractA.approve(poolAddress, valA)).wait();
      await (await contractB.approve(poolAddress, valB)).wait();

      setStatus(`Adding Liquidity...`);
      const poolT0 = await pool.token0();
      const isA_T0 = ethers.getAddress(poolT0) === ethers.getAddress(tokenA);
      
      const tx = await pool.addLiquidity(
        isA_T0 ? valA : valB, 
        isA_T0 ? valB : valA, 
        { gasLimit: 500000 }
      );
      await tx.wait();
      setStatus("Liquidity Added!");
      setStakeAmountA(""); setStakeAmountB("");
      fetchBlockchainData();
    } catch (err) { setStatus("Stake Failed."); }
    setLoading(false);
  };

  const handleRemoveLiquidity = async () => {
    const percent = parseFloat(removeAmount);
    if (!removeAmount || !poolAddress || percent <= 0 || percent > 100) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
      const totalSharesRaw = ethers.parseUnits(poolStats.myShares, 18);
      const sharesToRemove = (totalSharesRaw * BigInt(Math.floor(percent * 100))) / BigInt(10000);

      setStatus(`Removing Liquidity...`);
      const tx = await pool.removeLiquidity(sharesToRemove, { gasLimit: 300000 });
      await tx.wait();
      setStatus("Liquidity Removed!");
      setRemoveAmount("");
      fetchBlockchainData();
    } catch (err) { setStatus("Remove Failed."); }
    setLoading(false);
  };

  // --- REWARD / POSITION LOGIC ---
  const ownershipFactor = parseFloat(poolStats.totalShares) > 0
    ? (parseFloat(poolStats.myShares) / parseFloat(poolStats.totalShares))
    : 0;

  const ownershipPercentage = (ownershipFactor * 100).toFixed(4);

  // Calculate current entitlement (Initial Deposit + Accumulated Fees)
  const myEntitlementA = (parseFloat(poolStats.resA) * ownershipFactor).toFixed(4);
  const myEntitlementB = (parseFloat(poolStats.resB) * ownershipFactor).toFixed(4);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 px-4">
        <h1 className="text-2xl font-black text-blue-400 flex items-center gap-2">
          <LayoutGrid className="text-blue-500" /> MULTI_DEX
        </h1>
        <button onClick={connectWallet} className="bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2">
          <Wallet size={16} className="text-blue-400" />
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
        </button>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-3 shadow-2xl">
          <div className="px-4 py-2 space-y-2 mb-2 border-b border-slate-800 pb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase">Select Token Pair</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-400 flex justify-between items-center">
                <span>Fixed: {symbols.a}</span>
              </div>
              <div className="relative">
                <select 
                  value={tokenB}
                  onChange={(e) => setTokenB(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold appearance-none outline-none"
                >
                  {SUPPORTED_TOKENS.map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500" />
              </div>
            </div>
          </div>

          <div className="flex p-1 bg-slate-950 rounded-[2rem] mb-6">
            {["swap", "stake", "withdraw"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-[1.8rem] text-sm font-bold capitalize transition-all ${activeTab === tab ? "bg-slate-800 text-blue-400" : "text-slate-500"}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="px-4 pb-6 space-y-4">
            {!poolAddress && account ? (
               <div className="text-center py-6 bg-slate-950 rounded-3xl border border-dashed border-slate-700">
                 <p className="text-sm text-slate-400 mb-4">No Pool Found for {symbols.a}/{symbols.b}</p>
                 <button onClick={() => setStatus("Use handleCreatePool function")} className="bg-blue-600 px-6 py-2 rounded-xl font-bold flex items-center gap-2 mx-auto">
                   <PlusCircle size={18} /> Create Pool
                 </button>
               </div>
            ) : (
              <>
                {activeTab === "swap" && (
                  <>
                    <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 relative">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-1">
                        <span>Swap {isReversed ? symbols.a : symbols.b}</span>
                        <span>Max: {isReversed ? parseFloat(balances.a).toFixed(2) : parseFloat(balances.b).toFixed(2)}</span>
                      </div>
                      <input type="number" placeholder="0.0" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} className="w-full bg-transparent text-2xl outline-none font-bold mt-1"/>
                      <button 
                        onClick={() => setIsReversed(!isReversed)}
                        className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 p-2 rounded-full border border-slate-700 hover:text-blue-400 z-10"
                      >
                        <ArrowDownUp size={16} />
                      </button>
                    </div>

                    <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 mt-4">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-1">
                        <span>Receive {isReversed ? symbols.b : symbols.a}</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-400">{getAmountOut()}</div>
                    </div>

                    <button onClick={handleSwap} disabled={loading} className="w-full bg-blue-600 py-5 rounded-[1.8rem] font-black text-lg mt-4">
                      {loading ? <RefreshCw className="animate-spin mx-auto" /> : "Execute Swap"}
                    </button>
                  </>
                )}

                {activeTab === "stake" && (
                  <div className="space-y-2">
                    <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
                      <span className="text-[10px] font-black text-slate-500 uppercase">{symbols.a} Amount</span>
                      <input type="number" value={stakeAmountA} onChange={(e) => setStakeAmountA(e.target.value)} className="w-full bg-transparent text-2xl outline-none font-bold mt-1" placeholder="0.0"/>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
                      <span className="text-[10px] font-black text-slate-500 uppercase">{symbols.b} Amount</span>
                      <input type="number" value={stakeAmountB} onChange={(e) => setStakeAmountB(e.target.value)} className="w-full bg-transparent text-2xl outline-none font-bold mt-1" placeholder="0.0"/>
                    </div>
                    <button onClick={handleStake} disabled={loading} className="w-full bg-green-600 py-5 rounded-[1.8rem] font-black text-lg mt-2">
                      {loading ? <RefreshCw className="animate-spin mx-auto" /> : "Provide Liquidity"}
                    </button>
                  </div>
                )}

                {activeTab === "withdraw" && (
                  <>
                    <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase mb-1">
                        <span>Percentage to Remove</span>
                        <button onClick={() => setRemoveAmount("100")} className="text-red-400 hover:underline">Max: 100%</button>
                      </div>
                      <input type="number" value={removeAmount} onChange={(e) => setRemoveAmount(e.target.value)} className="w-full bg-transparent text-2xl outline-none font-bold mt-1" placeholder="0" />
                    </div>
                    <button onClick={handleRemoveLiquidity} disabled={loading} className="w-full bg-red-600 py-5 rounded-[1.8rem] font-black text-lg mt-4">
                      {loading ? <RefreshCw className="animate-spin mx-auto" /> : `Remove ${removeAmount || 0}% Liquidity`}
                    </button>
                  </>
                )}
              </>
            )}
            {status && <div className="mt-4 p-3 bg-blue-500/10 rounded-2xl text-[11px] font-mono text-blue-400 border border-blue-500/20 text-center">{status}</div>}
          </div>
        </div>

        {/* Stats Column */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl">
            <h2 className="text-lg font-black flex items-center gap-2 mb-4"><TrendingUp className="text-green-500" size={20} /> Pool Stats</h2>
            
            <a 
              href={`https://sepolia.etherscan.io/address/${poolAddress}`} 
              target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono text-slate-500 hover:text-blue-400 mb-6 block truncate"
            >
              {poolAddress || "No Pool Selected"}
            </a>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[10px] text-slate-600 font-bold uppercase">{symbols.a} Reserve</p>
                <p className="text-lg font-mono font-bold">{parseFloat(poolStats.resA).toLocaleString()}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[10px] text-slate-600 font-bold uppercase">{symbols.b} Reserve</p>
                <p className="text-lg font-mono font-bold">{parseFloat(poolStats.resB).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-blue-600/10 rounded-3xl p-5 border border-blue-500/20">
              <p className="text-[16px] text-blue-400 font-black uppercase mb-4">Share: {ownershipPercentage}%</p>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-6">
                <div className="bg-blue-500 h-full transition-all" style={{ width: `${Math.min(parseFloat(ownershipPercentage), 100)}%` }}></div>
              </div>

              {/* REWARDS / POSITION VALUE SECTION */}
              <div className="border-t border-blue-500/20 pt-4">
                <h3 className="text-[10px] font-black text-blue-400 uppercase flex items-center gap-2 mb-3">
                  <Gift size={14} /> My Position Value
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Staked {symbols.a}</span>
                    <span className="text-sm font-bold text-slate-200">{myEntitlementA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Staked {symbols.b}</span>
                    <span className="text-sm font-bold text-slate-200">{myEntitlementB}</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-600 mt-3 italic text-center">Value includes original deposit + swap fees</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <Coins size={20} className="text-yellow-500" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Wallet</p>
                <p className="text-sm font-bold text-slate-200">{parseFloat(balances.a).toFixed(2)} {symbols.a}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase">{symbols.b}</p>
              <p className="text-sm font-bold text-slate-200">{parseFloat(balances.b).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;