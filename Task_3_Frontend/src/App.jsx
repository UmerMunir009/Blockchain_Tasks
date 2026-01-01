import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  MARKET_ADDRESS,
  MARKET_ABI,
  ORACLE_ADDRESS,
  ORACLE_ABI,
  GREEN_YES_TOKEN_ADDRESS,
  GREEN_NO_TOKEN_ADDRESS,
  OUTCOME_TOKEN_ABI,
} from "./assets/constants";
import {
  Trophy,
  Wallet,
  TrendingUp,
  ShieldCheck,
  Gavel,
  Zap,
  CheckCircle2,
  ArrowUpRight,
  BarChart3,
  Clock,
  ArrowDownRight,
  Sparkles
} from "lucide-react";

function App() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [marketStats, setMarketStats] = useState({
    yesPrice: "0",
    noPrice: "0",
    poolYes: "0",
    poolNo: "0",
    isFinished: false,
    winner: null,
    winnerPayout: "0.01",
    contractBalance: "0",
  });

  const [userBalances, setUserBalances] = useState({
    eth: "0",
    yesTokens: "0",
    noTokens: "0",
  });

  const [betAmount, setBetAmount] = useState("");

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
      } catch (err) {
        setStatus("Connection failed");
      }
    }
  };

  const fetchData = useCallback(async () => {
    if (!window.ethereum || !account) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const market = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, provider);
      const yesToken = new ethers.Contract(
        GREEN_YES_TOKEN_ADDRESS,
        OUTCOME_TOKEN_ABI,
        provider
      );
      const noToken = new ethers.Contract(
        GREEN_NO_TOKEN_ADDRESS,
        OUTCOME_TOKEN_ABI,
        provider
      );

      const [yPrice, nPrice, pYes, pNo, finished, winner, balEth, balYes, balNo, winPay, contractEth] = await Promise.all([
        market.getYesPrice().catch(() => 0n),
        market.getNoPrice().catch(() => 0n),
        market.poolYes().catch(() => 0n),
        market.poolNo().catch(() => 0n),
        market.raceFinished().catch(() => false),
        market.greenCarVictory().catch(() => false),
        provider.getBalance(account),
        yesToken.balanceOf(account).catch(() => 0n),
        noToken.balanceOf(account).catch(() => 0n),
        market.WINNER_PAYOUT().catch(() => ethers.parseEther("0.01")),
        provider.getBalance(MARKET_ADDRESS),
      ]);

      setMarketStats({
        yesPrice: ethers.formatEther(yPrice),
        noPrice: ethers.formatEther(nPrice),
        poolYes: ethers.formatEther(pYes),
        poolNo: ethers.formatEther(pNo),
        isFinished: finished,
        winner: winner,
        winnerPayout: ethers.formatEther(winPay),
        contractBalance: ethers.formatEther(contractEth),
      });

      setUserBalances({
        eth: ethers.formatEther(balEth),
        yesTokens: ethers.formatEther(balYes),
        noTokens: ethers.formatEther(balNo),
      });
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [account]);

  useEffect(() => {
    if (account) fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [account, fetchData]);

  const getEstimatedPrice = (isYes) => {
    const input = parseFloat(betAmount) || 0;
    if (input === 0) return isYes ? marketStats.yesPrice : marketStats.noPrice;
    const pYes = parseFloat(marketStats.poolYes);
    const pNo = parseFloat(marketStats.poolNo);
    const payout = parseFloat(marketStats.winnerPayout);
    if (isYes) return ((pNo / (pYes + input + pNo)) * payout).toFixed(18);
    else return ((pYes / (pNo + input + pYes)) * payout).toFixed(18);
  };

  const handleBet = async (isYes) => {
    if (!betAmount || isNaN(betAmount)) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const market = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);
      const tx = isYes
        ? await market.betYes({ value: ethers.parseEther(betAmount) })
        : await market.betNo({ value: ethers.parseEther(betAmount) });
      setStatus("Broadcasting Bet...");
      await tx.wait();
      setStatus("Bet Successful!");
      setBetAmount("");
      fetchData();
    } catch (err) {
      setStatus("Transaction Failed");
    }
    setLoading(false);
  };

  const handleSell = async (isYes) => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const market = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);
      const amount = isYes ? userBalances.yesTokens : userBalances.noTokens;
      const tx = isYes
        ? await market.sellYesShares(ethers.parseEther(amount))
        : await market.sellNoShares(ethers.parseEther(amount));
      await tx.wait();
      setStatus("Shares Sold!");
      fetchData();
    } catch (err) {
      setStatus("Sell Failed");
    }
    setLoading(false);
  };

  const handleResolve = async (greenWon) => {
    setLoading(true);
    setStatus("Reporting Result...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, signer);
      const tx = await oracle.reportResult(MARKET_ADDRESS, greenWon);
      await tx.wait();
      setStatus(`Market Resolved!`);
      fetchData();
    } catch (err) {
      setStatus("Only owner can resolve market");
    }
    setLoading(false);
  };

  const handleClaim = async () => {
    setLoading(true);
    setStatus("Claiming Winnings...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const market = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer);
      const tx = await market.collectWinnings();
      await tx.wait();
      setStatus("Winnings Claimed successfully!");
      fetchData();
    } catch (err) {
      console.error(err);
      setStatus("Claim Failed - Do you have winning tokens?");
    }
    setLoading(false);
  };

  const totalPool = parseFloat(marketStats.poolYes) + parseFloat(marketStats.poolNo);
  const yesWeight = totalPool > 0 ? (parseFloat(marketStats.poolYes) / totalPool) * 100 : 50;

  return (
    <div className="min-h-screen bg-[#030014] text-slate-100 font-sans selection:bg-purple-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] bg-indigo-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl shadow-[0_0_25px_rgba(139,92,246,0.4)]">
              <Trophy className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-400">
                Poly_Race
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Sepolia Testnet Live
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl">
            <div className="px-4 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase">Balance</p>
              <p className="text-sm font-mono font-bold text-indigo-300">
                {parseFloat(userBalances.eth).toFixed(4)} ETH
              </p>
            </div>
            <div className="h-8 w-[1px] bg-white/10" />
            <button
              onClick={connectWallet}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl transition-all border border-purple-500/30"
            >
              <Wallet size={14} className="text-purple-400" />
              <span className="text-xs font-mono font-bold">
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
              </span>
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
              {marketStats.isFinished && (
                <div className="absolute inset-0 z-30 bg-[#030014]/95 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
                  <div className="bg-purple-500/20 p-6 rounded-full mb-6 border border-purple-500/30">
                    <CheckCircle2 size={80} className="text-purple-400" />
                  </div>
                  <h2 className="text-5xl font-black uppercase tracking-tighter italic text-white">
                    Race Settled
                  </h2>
                  <p className="text-xl text-indigo-400 font-bold mt-2 uppercase tracking-widest">
                    Winner: {marketStats.winner ? "Green Car" : "Red Car"}
                  </p>
                </div>
              )}

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider border border-purple-500/30">
                        Prediction Market
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                        <Clock size={12} /> 24h Left
                      </span>
                    </div>
                    <h2 className="text-3xl font-black leading-tight tracking-tight">
                      Will the <span className="text-indigo-400">Green Car</span> outperform the field?
                    </h2>
                  </div>
                  <Sparkles className="text-purple-500/50" />
                </div>

                <div className="bg-white/[0.02] rounded-3xl p-8 border border-white/5 mb-8 focus-within:border-purple-500/30 transition-all">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Stake Amount
                    </span>
                    <div className="flex gap-2">
                      {["0.01", "0.05", "0.1"].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setBetAmount(amt)}
                          className="text-[10px] font-bold bg-white/5 px-3 py-1 rounded-md hover:bg-purple-500/20 hover:text-purple-400 transition-colors border border-white/5"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="bg-transparent text-6xl font-black outline-none w-full placeholder:text-slate-800 text-white"
                    />
                    <span className="text-2xl font-black text-slate-700 italic">ETH</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group/card relative">
                    <button
                      onClick={() => handleBet(true)}
                      disabled={loading || marketStats.isFinished}
                      className="w-full bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 p-8 rounded-[2rem] transition-all relative overflow-hidden shadow-xl active:scale-[0.98] disabled:opacity-20 border border-white/10"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20 group-hover/card:scale-110 transition-transform">
                        <ArrowUpRight size={48} />
                      </div>
                      <p className="text-white/70 text-xs font-black uppercase tracking-widest mb-2 text-left">Bet Yes</p>
                      <p className="text-3xl font-mono font-black text-white text-left truncate">
                        {parseFloat(marketStats.yesPrice).toFixed(6)} <span className="text-sm">ETH</span>
                      </p>
                    </button>
                    <div className="mt-3 flex justify-between px-4 text-[10px] font-bold uppercase text-slate-500">
                      <span>Impact</span>
                      <span className="text-purple-400">{getEstimatedPrice(true).slice(0, 10)}...</span>
                    </div>
                  </div>

                  <div className="group/card relative">
                    <button
                      onClick={() => handleBet(false)}
                      disabled={loading || marketStats.isFinished}
                      className="w-full bg-slate-800/50 hover:bg-slate-800 p-8 rounded-[2rem] transition-all relative overflow-hidden shadow-xl active:scale-[0.98] disabled:opacity-20 border border-white/10"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20 group-hover/card:scale-110 transition-transform">
                        <ArrowDownRight size={48} />
                      </div>
                      <p className="text-white/70 text-xs font-black uppercase tracking-widest mb-2 text-left">Bet No</p>
                      <p className="text-3xl font-mono font-black text-white text-left truncate">
                        {parseFloat(marketStats.noPrice).toFixed(6)} <span className="text-sm">ETH</span>
                      </p>
                    </button>
                    <div className="mt-3 flex justify-between px-4 text-[10px] font-bold uppercase text-slate-500">
                      <span>Impact</span>
                      <span className="text-slate-400">{getEstimatedPrice(false).slice(0, 10)}...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-[0.2em] text-slate-400">
                  <ShieldCheck className="text-purple-500" size={18} /> Portfolio Holdings
                </h3>
                <BarChart3 className="text-slate-700" size={20} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: "YES Shares", value: userBalances.yesTokens, color: "text-purple-400", side: true },
                  { label: "NO Shares", value: userBalances.noTokens, color: "text-indigo-400", side: false },
                ].map((pos, idx) => {
                  const isWinner = marketStats.isFinished && pos.side === marketStats.winner;
                  const hasBalance = parseFloat(pos.value) > 0;

                  return (
                    <div
                      key={idx}
                      className={`bg-white/[0.02] p-6 rounded-3xl border ${
                        isWinner ? "border-purple-500/50" : "border-white/5"
                      } flex justify-between items-center group/item relative overflow-hidden`}
                    >
                      {isWinner && (
                        <div className="absolute top-0 right-0 bg-purple-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">
                          Winner
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{pos.label}</p>
                        <p className={`text-3xl font-mono font-black ${pos.color}`}>
                          {parseFloat(pos.value).toFixed(4)}
                        </p>
                      </div>

                      {hasBalance &&
                        (marketStats.isFinished ? (
                          isWinner && (
                            <button
                              onClick={handleClaim}
                              disabled={loading}
                              className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest shadow-[0_0_15px_rgba(139,92,246,0.3)] animate-pulse"
                            >
                              Claim ETH
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleSell(pos.side)}
                            className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest border border-white/5"
                          >
                            Exit
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
              <h2 className="text-sm font-black flex items-center gap-2 mb-8 uppercase tracking-[0.2em] text-slate-400 italic">
                <TrendingUp className="text-purple-500" size={20} /> Market Sentiment
              </h2>

              <div className="space-y-6">
                <div className="p-5 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-3 text-[10px] font-black uppercase tracking-widest">
                    <span className="text-purple-400">Chance of Win</span>
                    <span className="text-white">{yesWeight.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                      style={{ width: `${yesWeight}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Pool Yes</p>
                    <p className="text-xs font-mono font-bold text-purple-400 truncate">
                      {parseFloat(marketStats.poolYes).toFixed(4)}
                    </p>
                  </div>
                  <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Pool No</p>
                    <p className="text-xs font-mono font-bold text-indigo-400 truncate">
                      {parseFloat(marketStats.poolNo).toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Oracle Controls */}
            <div className="bg-white/[0.01] backdrop-blur-xl border border-purple-500/20 rounded-[2.5rem] p-8 border-dashed">
              <h3 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 mb-6 tracking-[0.2em]">
                <Gavel size={14} /> Settlement Engine
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleResolve(true)}
                  disabled={loading || marketStats.isFinished}
                  className="bg-purple-500/10 border border-purple-500/20 py-4 rounded-2xl text-[10px] font-black uppercase text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-10"
                >
                  Confirm Green
                </button>
                <button
                  onClick={() => handleResolve(false)}
                  disabled={loading || marketStats.isFinished}
                  className="bg-indigo-500/10 border border-indigo-500/20 py-4 rounded-2xl text-[10px] font-black uppercase text-indigo-400 hover:bg-indigo-500/20 transition-all disabled:opacity-10"
                >
                  Confirm Red
                </button>
              </div>
            </div>

            {status && (
              <div className="p-6 bg-purple-500/5 border border-purple-500/20 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-right duration-300">
                <div className="bg-purple-600 p-2 rounded-lg">
                  <Zap size={16} className="text-white animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Network Status</p>
                  <p className="text-xs font-mono font-bold text-purple-200 uppercase">{status}</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;