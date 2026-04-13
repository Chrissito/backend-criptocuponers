  import express from "express";
import dotenv from "dotenv";
import { Wallet, TokenSendRequest } from "mainnet-js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY;

const TOKEN_CATEGORY = process.env.TOKEN_CATEGORY;
const REWARD_PERCENT = Number(process.env.REWARD_PERCENT || 10);

let wallet;

// Inicializar wallet
async function initWallet() {
  if (process.env.WALLET_WIF) {
    wallet = await Wallet.fromWIF(process.env.WALLET_WIF);
  } else {
    throw new Error("Falta WALLET_WIF");
  }
}

// Calcular recompensa
function calcularRecompensa(monto) {
  return Math.floor((Number(monto) * REWARD_PERCENT) / 100);
}

// DEBUG info
async function getDebugInfo() {
  const bchBalance = await wallet.getBalance();
  const tokenBalance = await wallet.getTokenBalance(TOKEN_CATEGORY);
  const tokenUtxos = await wallet.getTokenUtxos(TOKEN_CATEGORY);

  return {
    cashaddr: wallet.cashaddr,
    tokenaddr: wallet.tokenaddr,
    bchBalance: bchBalance.toString(),
    tokenBalance: tokenBalance.toString(),
    tokenUtxoCount: tokenUtxos.length,
    tokenCategory: TOKEN_CATEGORY
  };
}

// HEALTH
app.get("/health", async (req, res) => {
  try {
    const info = await getDebugInfo();
    res.json({ ok: true, ...info });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ENVÍO
app.post("/reward", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== API_KEY) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { monto, walletDestino } = req.body;

    if (!Number.isFinite(Number(monto))) {
      return res.status(400).json({ error: "Monto inválido" });
    }

    if (!walletDestino) {
      return res.status(400).json({ error: "Wallet destino vacía" });
    }

    const recompensa = calcularRecompensa(monto);

    const debugBefore = await getDebugInfo();

    console.log("REWARD REQUEST:", JSON.stringify({
      monto,
      walletDestino,
      recompensa,
      tokenBalance: debugBefore.tokenBalance,
      utxos: debugBefore.tokenUtxoCount
    }));

    // 🔥 ENVÍO DIRECTO SIN PROBLEMAS DE DECIMALES
    const tx = await wallet.send([
      new TokenSendRequest({
        cashaddr: walletDestino,
        category: TOKEN_CATEGORY,
        amount: BigInt(recompensa),
        value: 1000n
      })
    ]);

    console.log("REWARD SENT:", tx.txId);

    res.json({
      ok: true,
      recompensa,
      txid: tx.txId
    });

  } catch (error) {
    console.error("REWARD ERROR:", error?.message || String(error));

    res.status(500).json({
      error: error.message
    });
  }
});

// START
initWallet()
  .then(async () => {
    const info = await getDebugInfo();
    console.log("WALLET INFO:", info);

    app.listen(PORT, () => {
      console.log("Servidor corriendo en puerto", PORT);
    });
  })
  .catch((error) => {
    console.error("Error al iniciar wallet:", error);
    process.exit(1);
  });
