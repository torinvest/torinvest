import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md pt-24 text-center">
      <Compass size={40} className="mx-auto mb-4 text-content-secondary" />
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-sm text-content-secondary">
        Cette page n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 text-sm text-content-secondary underline underline-offset-2 hover:text-content-primary"
      >
        <ArrowLeft size={15} /> Retour à l'accueil
      </Link>
    </div>
  );
}
