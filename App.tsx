// 1. DANS LE USEMEMO DES TRANSACTIONS EFFECTIVES
const effectiveTransactions = useMemo(() => {
  if (!activeAccount) return [];
  
  // On récupère les transactions réelles du mois
  const manuals = activeAccount.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // On identifie quels templates ont déjà été "payés" (matérialisés) ce mois-ci
  // On regarde le templateId ET le mois/année de la transaction
  const materializedTemplateIds = new Set(
    manuals.map(t => t.templateId).filter(Boolean)
  );

  const deletedVirtuals = new Set(activeAccount.deletedVirtualIds || []);

  // 2. Génération des virtuelles pour COMBLER les vides
  const virtuals: Transaction[] = (activeAccount.recurringTemplates || [])
    .filter(tpl => {
      // On ne garde que les actifs ET ceux qui ne sont pas déjà dans "manuals"
      return tpl.isActive && !materializedTemplateIds.has(tpl.id);
    })
    .map(tpl => {
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const day = Math.min(tpl.dayOfMonth, lastDay);
      const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;

      return {
        id: vId,
        amount: tpl.amount, 
        type: tpl.type, 
        categoryId: tpl.categoryId,
        comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
        date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
        isRecurring: true, 
        templateId: tpl.id
      };
    })
    // On ne les affiche que si elles n'ont pas été supprimées manuellement (swipe delete)
    .filter(v => !deletedVirtuals.has(v.id));

  return [...manuals, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}, [activeAccount, currentMonth, currentYear]);


// 2. DANS LA FONCTION DE SAUVEGARDE
const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
  setState(prev => {
    const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
    if (accIndex === -1) return prev;
    
    const acc = { ...prev.accounts[accIndex] };
    let nextTx = [...acc.transactions];
    let nextDeleted = [...(acc.deletedVirtualIds || [])];
    
    const targetId = t.id || editingTransaction?.id;
    const isVirtual = targetId?.toString().startsWith('virtual-');

    if (isVirtual) {
      // CAS CRITIQUE : Si on modifie ou valide une virtuelle
      // 1. On l'ajoute aux "supprimées" pour que le moteur de projection ne la recrée pas
      nextDeleted.push(targetId!);
      // 2. On l'ajoute comme une transaction RÉELLE avec son templateId
      // C'est ce lien qui empêchera les doublons le mois prochain
      nextTx = [{ ...t, id: generateId() } as Transaction, ...nextTx];
    } else if (targetId && nextTx.some(i => i.id === targetId)) {
      // Simple mise à jour d'une transaction existante
      nextTx = nextTx.map(i => i.id === targetId ? ({ ...t, id: targetId } as Transaction) : i);
    } else {
      // Nouvel ajout manuel
      nextTx = [{ ...t, id: generateId() } as Transaction, ...nextTx];
    }

    const nextAccounts = [...prev.accounts];
    nextAccounts[accIndex] = { ...acc, transactions: nextTx, deletedVirtualIds: nextDeleted };
    return { ...prev, accounts: nextAccounts };
  });
  setShowAddModal(false);
  setEditingTransaction(null);
};