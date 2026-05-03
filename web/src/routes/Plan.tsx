import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import planMarkdown from "../content/plan.md?raw";

export function Plan() {
  return (
    <article className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{planMarkdown}</ReactMarkdown>
    </article>
  );
}
