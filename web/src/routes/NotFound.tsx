import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <section className="not-found">
      <h2>Not found</h2>
      <p>
        That route doesn't exist. <Link to="/">Back to engine</Link>.
      </p>
    </section>
  );
}
