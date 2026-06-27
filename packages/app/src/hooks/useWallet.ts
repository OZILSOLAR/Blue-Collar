export { useWallet } from "@/context/WalletContext";
import { useWallet } from "@/context/WalletContext";

export function useWalletNetworkWarning() {
  const { networkWarning, network } = useWallet();
  return { networkWarning, network };
}
