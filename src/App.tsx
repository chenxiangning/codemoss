import "./bootstrap";
import { TooltipProvider } from "./components/ui/tooltip";
import { AppRouter } from "./router";

function App() {
  // P2-2: single ambient TooltipProvider so dense chrome does not mount
  // hundreds of nested Providers on cold start.
  return (
    <TooltipProvider>
      <AppRouter />
    </TooltipProvider>
  );
}

export default App;
