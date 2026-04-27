import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWallet } from '../../services/walletService';
import api from '../../services/api';
import styles from './Wallet.module.css';

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000, 5000];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Wallet() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState('all');

  if (!user) { navigate('/login'); return null; }

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getWallet();
      setBalance(data.balance);
      setTransactions(data.transactions || []);
      if (updateUser) updateUser({ ...user, walletBalance: data.balance });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const handleAddFunds = async (e) => {
    e.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed < 10 || parsed > 100000) {
      setMsg({ type: 'error', text: 'Enter a valid amount between ₹10 and ₹1,00,000' });
      return;
    }
    setAdding(true);
    setMsg(null);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setMsg({ type: 'error', text: 'Failed to load payment gateway' });
        setAdding(false);
        return;
      }

      // Create order
      const { data: orderData } = await api.post('/wallet/create-order', { amount: parsed });

      const options = {
        key: orderData.key,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'turf11',
        description: 'Wallet Top-up',
        order_id: orderData.order.id,
        handler: async (response) => {
          try {
            // Verify payment
            const { data: verifyData } = await api.post('/wallet/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setBalance(verifyData.balance);
            setTransactions((prev) => [verifyData.transaction, ...prev]);
            if (updateUser) updateUser({ ...user, walletBalance: verifyData.balance });
            setMsg({ type: 'success', text: `₹${parsed} added to your wallet!` });
            setAmount('');
          } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || 'Payment verification failed' });
          } finally {
            setAdding(false);
          }
        },
        modal: {
          ondismiss: () => {
            setAdding(false);
            setMsg({ type: 'error', text: 'Payment cancelled' });
          },
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || '',
        },
        theme: {
          color: '#00d4aa',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create order' });
      setAdding(false);
    }
  };

  const filtered = transactions.filter((t) => tab === 'all' || t.type === tab);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1 className={styles.pageTitle}>My Wallet</h1>
            <p className={styles.pageSubtitle}>Manage your wallet balance & transactions</p>
          </div>
        </div>

        <div className={styles.grid}>
          {/* ── Left Column ── */}
          <div className={styles.leftCol}>
            {/* Balance Card */}
            <div className={styles.balanceCard}>
              <div className={styles.balanceCardBg} />
              <div className={styles.balanceContent}>
                <div className={styles.walletIcon}>💰</div>
                <p className={styles.balanceLabel}>Available Balance</p>
                {loading ? (
                  <div className={styles.balanceSkeleton} />
                ) : (
                  <h2 className={styles.balanceAmount}>
                    ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                )}
                <p className={styles.balanceFooter}>Use at checkout · Zero extra charges</p>
              </div>
              <div className={styles.balanceDecor1} />
              <div className={styles.balanceDecor2} />
            </div>

            {/* Add Money Card */}
            <div className={styles.addCard}>
              <h3 className={styles.addTitle}>Add Money to Wallet</h3>
              <p className={styles.addSubtitle}>Funds added here can be used for booking turfs</p>

              <form onSubmit={handleAddFunds} className={styles.addForm}>
                {/* Quick amounts */}
                <div className={styles.quickGrid}>
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`${styles.quickBtn} ${Number(amount) === q ? styles.quickActive : ''}`}
                      onClick={() => setAmount(String(q))}
                    >
                      ₹{q.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div className={styles.inputWrap}>
                  <span className={styles.rupeeSign}>₹</span>
                  <input
                    type="number"
                    min={10}
                    max={100000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter custom amount"
                    className={styles.amtInput}
                    id="wallet-amount"
                  />
                </div>

                {msg && (
                  <div className={`${styles.msg} ${msg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                    {msg.type === 'success' ? '✅' : '❌'} {msg.text}
                  </div>
                )}

                <button type="submit" className={styles.addBtn} disabled={adding || !amount}>
                  {adding ? (
                    <span className={styles.btnSpinner} />
                  ) : '💳 Add to Wallet'}
                </button>
              </form>
            </div>

            {/* Info card */}
            <div className={styles.infoCard}>
              <h4 className={styles.infoTitle}>ℹ️ How Wallet Works</h4>
              <ul className={styles.infoList}>
                <li>Add money once, use it for multiple bookings</li>
                <li>Select "Pay with Wallet" during checkout</li>
                <li>Combine wallet + cash for partial payments</li>
                <li>Wallet balance never expires</li>
              </ul>
            </div>
          </div>

          {/* ── Right Column — Transactions ── */}
          <div className={styles.rightCol}>
            <div className={styles.txnCard}>
              <div className={styles.txnHeader}>
                <h3 className={styles.txnTitle}>Transaction History</h3>
                <div className={styles.tabGroup}>
                  {['all', 'credit', 'debit'].map((t) => (
                    <button
                      key={t}
                      className={`${styles.tabBtn} ${tab === t ? styles.tabActive : ''}`}
                      onClick={() => setTab(t)}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className={styles.txnLoading}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={styles.txnSkeleton} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.emptyTxn}>
                  <div className={styles.emptyIcon}>📋</div>
                  <p>No {tab !== 'all' ? tab : ''} transactions yet</p>
                  <span>Add money to get started</span>
                </div>
              ) : (
                <div className={styles.txnList}>
                  {filtered.map((txn) => (
                    <div key={txn.id} className={styles.txnRow}>
                      <div className={`${styles.txnTypeIcon} ${txn.type === 'credit' ? styles.creditIcon : styles.debitIcon}`}>
                        {txn.type === 'credit' ? '↑' : '↓'}
                      </div>
                      <div className={styles.txnInfo}>
                        <p className={styles.txnDesc}>{txn.description}</p>
                        <span className={styles.txnDate}>{formatDate(txn.created_at)}</span>
                      </div>
                      <div className={styles.txnRight}>
                        <span className={`${styles.txnAmt} ${txn.type === 'credit' ? styles.creditAmt : styles.debitAmt}`}>
                          {txn.type === 'credit' ? '+' : '−'}₹{Number(txn.amount).toLocaleString('en-IN')}
                        </span>
                        <span className={styles.txnBal}>Bal: ₹{Number(txn.balance_after).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
