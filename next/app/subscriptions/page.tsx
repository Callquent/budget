import Link from "next/link";
import SubscriptionList from "@/components/SubscriptionList";

export default function SubscriptionsPage() {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-arrow-repeat me-2 text-primary"></i>Abonnements
        </h1>
        <Link href="/subscriptions/new" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Nouvel abonnement
        </Link>
      </div>
      <SubscriptionList />
    </>
  );
}
