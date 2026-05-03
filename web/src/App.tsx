import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { Engine } from "./routes/Engine";
import { Plan } from "./routes/Plan";
import { NotFound } from "./routes/NotFound";

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <main className="page">
        <header className="page__header">
          <h1>HEM Field Assessment Tool</h1>
          <Nav />
        </header>
        <Routes>
          <Route path="/" element={<Engine />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
