import { Layout } from "@/components/Layout";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user } = useAuth();
  const { loadingData } = useApp();

  if (!user) {
    return null; // ProtectedRoute will handle redirect
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <Layout />;
};

export default Index;