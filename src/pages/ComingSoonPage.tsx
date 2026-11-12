import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';

type Props = {
  title: string;
};

/** Strona zastępcza dla funkcji, które są w planie, ale nie zostały jeszcze zrobione. */
export default function ComingSoonPage({ title }: Props) {
  return (
    <main className="p-8">
      <div className="max-w-lg mx-auto mt-16 py-16 px-6 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800">
        <Construction className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-2">
          Ta funkcja jest w przygotowaniu i pojawi się w kolejnych sprintach.
        </p>
        <Link
          to="/"
          className="inline-flex mt-6 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition"
        >
          Wróć na stronę główną
        </Link>
      </div>
    </main>
  );
}
