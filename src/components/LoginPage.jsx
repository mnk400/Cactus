import { useState } from "react";
import { FIELD } from "./ui/Panel";

function LoginPage({ onLoginSuccess }) {
  const [keyphrase, setKeyphrase] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyphrase }),
      });

      if (response.ok) {
        onLoginSuccess();
      } else {
        const data = await response.json();
        setError(data.error || "that keyphrase didn't work");
      }
    } catch {
      setError("can't reach the server. check that cactus is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-black text-[13px]">
      <div className="surface mx-4 w-full max-w-xs rounded-[22px] p-5">
        <h1 className="m-0 text-lg font-semibold text-white">cactus</h1>
        <p className="mb-4 mt-0.5 text-white/45">
          enter the keyphrase to continue
        </p>

        {error && <p className="mb-3 mt-0 px-1 text-red-300">{error}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="password"
            value={keyphrase}
            onChange={(e) => setKeyphrase(e.target.value)}
            placeholder="keyphrase"
            autoFocus
            required
            className={`${FIELD} w-full`}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="pill-on h-9 w-full rounded-full font-medium active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "unlocking…" : "unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
