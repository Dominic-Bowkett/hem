import { NavLink } from "react-router-dom";

export function Nav() {
  return (
    <nav className="nav">
      <NavLink to="/" end className="nav__link">
        Engine
      </NavLink>
      <NavLink to="/plan" className="nav__link">
        Plan
      </NavLink>
      <a
        href="https://github.com/dominic-bowkett/hem"
        target="_blank"
        rel="noreferrer"
        className="nav__link nav__link--ext"
      >
        GitHub
      </a>
    </nav>
  );
}
