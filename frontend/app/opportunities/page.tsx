      setIsCreatingGoal(true);
      setSearchQuery('');

      await createOpportunityFromGoal(goal, companyId);

      // Refresh opportunities
      const response = await getOpportunityDashboard(companyId);
      setReport(response.data as OpportunityReport);
    } catch (err) {
      console.error('Error creating opportunity:', err);
      setError(err instanceof Error ? err.message : 'Failed to create opportunity');
    } finally {
      setIsCreatingGoal(false);
    }
  }

  // Loading state
  if (loading && !report) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#5B4FFF]" />
          <p className="text-sm text-[#6B7280]">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Left Sidebar - Filters */}
      <aside className="w-64 border-r border-[#E5E7EB] bg-white p-4 flex-shrink-0">
        {/* Categories */}
        <div className="mb-6">
          {(['all', 'recovery', 'retention', 'expansion', 'loyalty'] as CategoryType[]).map((category) => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config.icon;
            const stats = categoryStats[category];
            const isActive = selectedCategory === category;

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-[#5B4FFF] text-white'
                    : 'text-[#4B5563] hover:bg-[#F3F4F6]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                {category !== 'all' && stats.count > 0 && (
                  <span className={`text-xs ${isActive ? 'text-white/80' : 'text-[#9CA3AF]'}`}>
                    {stats.count} • {formatCurrency(stats.revenue)}
                  </span>
                )}
              </button>
            );