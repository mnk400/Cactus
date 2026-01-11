import { useState } from "react";

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
        setError(data.error || "Invalid keyphrase");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-black">
      <div className="w-full max-w-sm mx-4 p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
          Cactus
        </h1>
        <p className="text-sm text-gray-400 mb-6">Enter keyphrase to continue</p>

        {error && (
          <div className="mb-4 p-2.5 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={keyphrase}
            onChange={(e) => setKeyphrase(e.target.value)}
            placeholder="Keyphrase"
            autoFocus
            required
            className="w-full px-3 py-2.5 bg-black bg-opacity-50 border border-white border-opacity-20 rounded-xl text-white text-sm placeholder-gray-500 outline-none focus:border-opacity-40 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-white bg-opacity-20 text-white font-medium rounded-xl hover:bg-opacity-30 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Unlocking..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
