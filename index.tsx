// --- MOTEUR DE PROJECTION UNIVERSEL CORRIGÉ ---

  const getProjectedBalanceAtDate = (targetDate: Date) => {
    if (!activeAccount) return 0;
    
    const today = new Date();
    // 1. On commence par TOUTES les transactions réelles passées ET futures (si encodées)
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      return tDate <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    const templates = activeAccount.recurringTemplates || [];
    const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);
    
    // 2. On part de "Maintenant" pour projeter le futur
    // On commence au 1er jour du mois actuel pour vérifier s'il reste des fixes à payer ce mois-ci
    let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    const targetTS = targetDate.getTime();
    
    let safety = 60; // Protection 5 ans
    while (cursor.getTime() <= targetTS && safety > 0) {
      const cMonth = cursor.getMonth();
      const cYear = cursor.getFullYear();
      
      // On récupère ce qui est déjà matérialisé pour CE mois précis
      const materializedIds = new Set(
        activeAccount.transactions
          .filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === cYear && d.getMonth() === cMonth && t.templateId;
          })
          .map(t => String(t.templateId))
      );

      templates.forEach(tpl => {
        if (!tpl.isActive) return;
        
        const lastDay = new Date(cYear, cMonth + 1, 0).getDate();
        const day = Math.min(tpl.dayOfMonth, lastDay);
        const tplDate = new Date(cYear, cMonth, day, 12, 0, 0);
        const vId = `virtual-${tpl.id}-${cMonth}-${cYear}`;

        // CRITÈRE DE PROJECTION :
        // - La date du fixe est dans le futur par rapport à "maintenant" (ou c'est aujourd'hui)
        // - ET elle est avant ou égale à ma date cible
        // - ET elle n'est pas déjà faite (matérialisée)
        // - ET elle n'est pas supprimée
        const isFutureOrToday = tplDate.getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const isBeforeTarget = tplDate.getTime() <= targetTS;

        if (isFutureOrToday && isBeforeTarget && !materializedIds.has(String(tpl.id)) && !deletedVirtuals.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });

      cursor.setMonth(cursor.getMonth() + 1);
      safety--;
    }

    return balance;
  };

  // --- CALCULS DES SOLDES UI (Inchangés mais vérifiés) ---

  const checkingAccountBalance = useMemo(() => {
    if (!activeAccount) return 0;
    // Somme brute de la base de donnée (Transactions pointées)
    return activeAccount.transactions.reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : -t.amount), 0);
  }, [activeAccount]);

  const availableBalance = useMemo(() => {
    // Fin du mois en cours (Projection court terme)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(endOfMonth);
  }, [activeAccount, now]);

  const projectedBalance = useMemo(() => {
    // Fin du mois affiché (Projection long terme)
    const endOfView = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(endOfView);
  }, [activeAccount, currentMonth, currentYear]);

  const carryOver = useMemo(() => {
    // Solde à la veille du mois affiché
    const lastDayPrev = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    return getProjectedBalanceAtDate(lastDayPrev);
  }, [activeAccount, currentMonth, currentYear]);