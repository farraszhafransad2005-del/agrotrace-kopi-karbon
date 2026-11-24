import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getAudit,
  getCarbonAnalysis,
  getHealth,
  getMethodology,
  getOverview,
  refreshCache,
} from "./api/client";
import Navbar from "./components/Navbar";
import OverviewPage from "./pages/OverviewPage";
import BatchExplorerPage from "./pages/BatchExplorerPage";
import CarbonAnalysisPage from "./pages/CarbonAnalysisPage";
import AuditPage from "./pages/AuditPage";
import MethodologyPage from "./pages/MethodologyPage";

function getInitialRouteState() {
  if (typeof window === "undefined") {
    return { tab: "overview", fgId: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const batchParam = params.get("batch");
  if (batchParam) {
    return { tab: "batch", fgId: batchParam };
  }
  return { tab: "overview", fgId: "" };
}

export default function App() {
  const initial = getInitialRouteState();
  const [activeTab, setActiveTab] = useState(initial.tab);
  const [selectedFgId, setSelectedFgId] = useState(initial.fgId);

  const [health, setHealth] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState({ data: null, loading: true, error: null });
  const [carbon, setCarbon] = useState({ data: null, loading: false, error: null });
  const [auditState, setAuditState] = useState({ data: null, loading: false, error: null });
  const [onlyReview, setOnlyReview] = useState(true);
  const [methodology, setMethodology] = useState({ data: null, loading: false, error: null });

  const loadHealth = useCallback(() => {
    getHealth()
      .then((res) => setHealth(res))
      .catch(() => {});
  }, []);

  const loadOverview = useCallback(() => {
    setOverview((prev) => ({ ...prev, loading: true, error: null }));
    getOverview()
      .then((res) => setOverview({ data: res, loading: false, error: null }))
      .catch((err) => setOverview({ data: null, loading: false, error: err.message }));
  }, []);

  const loadCarbon = useCallback(() => {
    setCarbon((prev) => ({ ...prev, loading: true, error: null }));
    getCarbonAnalysis()
      .then((res) => setCarbon({ data: res, loading: false, error: null }))
      .catch((err) => setCarbon({ data: null, loading: false, error: err.message }));
  }, []);

  const loadAudit = useCallback((reviewFlag) => {
    setAuditState((prev) => ({ ...prev, loading: true, error: null }));
    getAudit(reviewFlag)
      .then((res) => setAuditState({ data: res, loading: false, error: null }))
      .catch((err) => setAuditState({ data: null, loading: false, error: err.message }));
  }, []);

  const loadMethodology = useCallback(() => {
    setMethodology((prev) => ({ ...prev, loading: true, error: null }));
    getMethodology()
      .then((res) => setMethodology({ data: res, loading: false, error: null }))
      .catch((err) => setMethodology({ data: null, loading: false, error: err.message }));
  }, []);

  // Initial load
  useEffect(() => {
    loadHealth();
    loadOverview();
  }, [loadHealth, loadOverview]);

  // Lazy load page data when navigating tabs
  useEffect(() => {
    if (activeTab === "carbon" && !carbon.data && !carbon.loading) {
      loadCarbon();
    }
    if (activeTab === "audit" && !auditState.data && !auditState.loading) {
      loadAudit(onlyReview);
    }
    if (activeTab === "methodology" && !methodology.data && !methodology.loading) {
      loadMethodology();
    }
  }, [
    activeTab,
    carbon.data,
    carbon.loading,
    auditState.data,
    auditState.loading,
    methodology.data,
    methodology.loading,
    onlyReview,
    loadCarbon,
    loadAudit,
    loadMethodology,
  ]);

  // Keep URL query ?batch=<fg_id> synced when exploring batches
  const handleSelectBatch = useCallback((fgId) => {
    setSelectedFgId(fgId);
    if (typeof window !== "undefined" && fgId) {
      const url = new URL(window.location.href);
      url.searchParams.set("batch", fgId);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleOpenBatchFromAnywhere = useCallback(
    (fgId) => {
      handleSelectBatch(fgId);
      setActiveTab("batch");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [handleSelectBatch]
  );

  const handleToggleOnlyReview = useCallback(
    (nextVal) => {
      setOnlyReview(nextVal);
      loadAudit(nextVal);
    },
    [loadAudit]
  );

  const handleRefreshAll = useCallback(() => {
    setRefreshing(true);
    refreshCache()
      .then((res) => {
        setHealth(res);
        loadOverview();
        if (carbon.data) loadCarbon();
        if (auditState.data) loadAudit(onlyReview);
        if (methodology.data) loadMethodology();
      })
      .finally(() => setRefreshing(false));
  }, [
    loadOverview,
    loadCarbon,
    loadAudit,
    loadMethodology,
    carbon.data,
    auditState.data,
    methodology.data,
    onlyReview,
  ]);

  return (
    <div className="min-h-screen pb-14">
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        health={health}
        refreshing={refreshing}
        onRefresh={handleRefreshAll}
      />

      <main className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === "overview" && (
              <OverviewPage
                data={overview.data}
                loading={overview.loading}
                error={overview.error}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === "batch" && (
              <BatchExplorerPage
                selectedFgId={selectedFgId}
                onSelectFgId={handleSelectBatch}
              />
            )}

            {activeTab === "carbon" && (
              <CarbonAnalysisPage
                data={carbon.data}
                loading={carbon.loading}
                error={carbon.error}
                onOpenBatch={handleOpenBatchFromAnywhere}
              />
            )}

            {activeTab === "audit" && (
              <AuditPage
                data={auditState.data}
                loading={auditState.loading}
                error={auditState.error}
                onlyReview={onlyReview}
                onToggleOnlyReview={handleToggleOnlyReview}
                onOpenBatch={handleOpenBatchFromAnywhere}
              />
            )}

            {activeTab === "methodology" && (
              <MethodologyPage
                data={methodology.data}
                loading={methodology.loading}
                error={methodology.error}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
