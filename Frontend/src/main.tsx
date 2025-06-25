import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { App } from './app'
import './index.css'
import { Toaster } from 'sonner'
import { StateContextProvider } from './contexts'
import { WagmiConfig, createConfig } from 'wagmi'
import { RainbowKitProvider, getDefaultWallets, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { arbitrumSepolia } from 'wagmi/chains'
import { createPublicClient, http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a client for React Query
const queryClient = new QueryClient();

const { connectors } = getDefaultWallets({
  appName: 'CrowdFunding App',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Replace with your project ID
  chains: [arbitrumSepolia]
});

const config = createConfig({
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
  connectors,
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <QueryClientProvider client={queryClient}>
    <WagmiConfig config={config}>
      <RainbowKitProvider chains={[arbitrumSepolia]} theme={darkTheme()}>
        <Router>
          <StateContextProvider>
            <App />
          </StateContextProvider>
        </Router>
        <Toaster richColors />
      </RainbowKitProvider>
    </WagmiConfig>
  </QueryClientProvider>
)