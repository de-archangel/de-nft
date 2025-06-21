"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useToast } from "@/hooks/use-toast";

interface WalletContextType {
  isConnected: boolean;
  address: string;
  isCorrectNetwork: boolean;
  balance: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: () => Promise<void>;
  isLoading: boolean;
  sendTransaction: (
    to: string,
    value: string,
    data?: string
  ) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

const OG_NETWORK_CONFIG = {
  chainId: 16601,
  chainIdHex: "0x40D9",
  chainName: "0G-Galileo-Testnet",
  nativeCurrency: {
    name: "OG",
    symbol: "OG",
    decimals: 18,
  },
  rpcUrls: ["https://evmrpc-testnet.0g.ai"],
  blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
};

const OG_NETWORK_CONFIG_ADD_NETWORK = {
  chainId: "0x40D9",
  chainName: "0G-Galileo-Testnet",
  nativeCurrency: {
    name: "OG",
    symbol: "OG",
    decimals: 18,
  },
  rpcUrls: ["https://evmrpc-testnet.0g.ai"],
  blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
};

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const hasShownNetworkWarning = useRef(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    const run = async () => {
      const wallet_connected = sessionStorage.getItem("wallet_connected");
      if (wallet_connected) {
        await connectWallet();
      }
      if (typeof window.ethereum !== "undefined") {
        window.ethereum.on("accountsChanged", handleAccountsChanged);
        window.ethereum.on("chainChanged", handleChainChanged);
        window.ethereum.on("disconnect", handleDisconnect);
      }

      return () => {
        if (typeof window.ethereum !== "undefined") {
          window.ethereum.removeListener(
            "accountsChanged",
            handleAccountsChanged
          );
          window.ethereum.removeListener("chainChanged", handleChainChanged);
          window.ethereum.removeListener("disconnect", handleDisconnect);
        }
      };
    };

    run();
  }, []);

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAddress(accounts[0]);
      await getBalance(accounts[0]);
    }
  };

  const handleChainChanged = async (chainId: string) => {
    const isCorrect = chainId === OG_NETWORK_CONFIG.chainIdHex;
    if (!isCorrect) {
      await switchNetwork();
    }
    // Only show notification if user is connected and initialized
    if (
      isConnected &&
      isInitialized.current &&
      !hasShownNetworkWarning.current
    ) {
      toast({
        title: "✅ Network Connected",
        description: "Successfully connected to 0G Network!",
      });
      setIsCorrectNetwork(true);

      hasShownNetworkWarning.current = true;
      // Reset the flag after 5 seconds
      setTimeout(() => {
        hasShownNetworkWarning.current = false;
      }, 5000);
    }
  };

  const getBalance = async (address: string) => {
    try {
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      const balanceInOG = (
        Number.parseInt(balance, 16) / Math.pow(10, 18)
      ).toFixed(4);
      setBalance(balanceInOG);
     } catch (error) {
      console.error("Error getting balance:", error);
    }
  };

  const addNetwork = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [OG_NETWORK_CONFIG_ADD_NETWORK],
      });

      toast({
        title: "🎉 Network Added",
        description: "0G Network has been successfully added to your wallet!",
      });
    } catch (error) {
      console.error("Error adding network:", error);
      throw error;
    }
  };

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: OG_NETWORK_CONFIG.chainIdHex }],
      });
      toast({
        title: "✅ Network Switched",
        description: "Successfully switched to 0G Network!",
      });
      setIsCorrectNetwork(true);
    } catch (error: any) {
      if (error.code === 4902) {
        alert(error.code);
        await addNetwork();
      } else {
        toast({
          title: "❌ Network Switch Failed",
          description:
            "Failed to switch to 0G Network. Please try manually in your wallet.",
          variant: "destructive",
        });
        throw error;
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      toast({
        title: "❌ MetaMask Not Found",
        description:
          "Please install MetaMask or another Web3 wallet to connect.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setIsConnected(true);
      setAddress(accounts[0]);
      const chainId = await window.ethereum.request({ method: "eth_chainId" });

      const isCorrect = chainId === OG_NETWORK_CONFIG.chainIdHex;
      if (!isCorrect) {
        await switchNetwork();
      }
      setIsCorrectNetwork(true);
      await getBalance(accounts[0]);
      sessionStorage.setItem("wallet_connected", "true");

      toast({
        title: "🎉 Wallet Connected",
        description: "Wallet connected successfully!",
      });
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
      if (error.code === 4001) {
        toast({
          title: "⚠️ Connection Rejected",
          description: "Wallet connection was rejected by user.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ Connection Failed",
          description:
            error.message || "Failed to connect wallet. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress("");
    setBalance("0");

    toast({
      title: "👋 Wallet Disconnected",
      description: "Your wallet has been disconnected from the marketplace.",
    });
    sessionStorage.removeItem("wallet_connected");
    setIsLoading(false);
  };

  const sendTransaction = async (
    to: string,
    value: string,
    data?: string
  ): Promise<string> => {
    if (!isConnected) {
      throw new Error("Wallet not connected");
    }
    try {
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to,
            value: `0x${Number.parseInt(value).toString(16)}`,
            data: data || "0x",
          },
        ],
      });

      return txHash;
    } catch (error: any) {
      console.error("Transaction failed:", error);
      throw new Error(error.message || "Transaction failed");
    }
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address,
        balance,
        isCorrectNetwork,
        connectWallet,
        disconnectWallet,
        switchNetwork,
        isLoading,
        sendTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
