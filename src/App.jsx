import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/context/ThemeContext"

// Create a single QueryClient instance for the whole app
const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Pages />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App 
