type QuizCardProps = {
  title: string;
  uploader: string;
  genre: string;
  difficulty: string;
  price: string;
};

export default function QuizCard({
  title,
  uploader,
  genre,
  difficulty,
  price,
}: QuizCardProps) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition duration-300 hover:-translate-y-2 hover:border-purple-500/40 hover:bg-white/10">

      <div className="h-44 bg-gradient-to-br from-purple-700/40 to-cyan-700/20" />

      <div className="space-y-4 p-5">

        <div className="flex items-center justify-between">
          <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-300">
            {genre}
          </span>

          <span className="text-xs text-gray-400">
            {difficulty}
          </span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">
            {title}
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Uploaded by {uploader}
          </p>
        </div>

        <div className="flex items-center justify-between">

          <span className="text-lg font-bold text-cyan-400">
            {price}
          </span>

          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200">
            View Set
          </button>

        </div>

      </div>
    </div>
  );
}