import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  DollarSign,
  Users,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type ExportFormat = 'excel' | 'pdf';
type DateRange = 'all' | 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year';

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'last_year', label: 'Last Year' },
];

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);
  const getMemberDuesByHalau = useAppStore((s) => s.getMemberDuesByHalau);
  const getTransactionsByHalau = useAppStore((s) => s.getTransactionsByHalau);
  const members = useAppStore((s) => s.members);

  // State
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includeDues, setIncludeDues] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeAiSummary, setIncludeAiSummary] = useState(false);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Get filtered data based on date range
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last_3_months':
        return { start: subMonths(now, 3), end: now };
      case 'last_6_months':
        return { start: subMonths(now, 6), end: now };
      case 'last_year':
        return { start: subMonths(now, 12), end: now };
      default:
        return null;
    }
  };

  const memberDues = useMemo(() => {
    if (!currentHalauId) return [];
    const dues = getMemberDuesByHalau(currentHalauId);
    const filter = getDateFilter();
    if (!filter) return dues;
    return dues.filter((d) => {
      const date = parseISO(d.dueDate);
      return date >= filter.start && date <= filter.end;
    });
  }, [currentHalauId, getMemberDuesByHalau, dateRange]);

  const transactions = useMemo(() => {
    if (!currentHalauId) return [];
    const txns = getTransactionsByHalau(currentHalauId);
    const filter = getDateFilter();
    if (!filter) return txns;
    return txns.filter((t) => {
      const date = parseISO(t.processedAt);
      return date >= filter.start && date <= filter.end;
    });
  }, [currentHalauId, getTransactionsByHalau, dateRange]);

  const getMemberName = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  // Generate a 3-5 sentence natural-language AI summary from computed data — no API calls
  const generateAiSummary = () => {
    const collectionRate = summary.totalDuesAmount > 0
      ? Math.round((summary.totalPaid / summary.totalDuesAmount) * 100)
      : 0;
    const dateRangeLabel = DATE_RANGES.find((d) => d.value === dateRange)?.label || 'all time';
    const lines: string[] = [];

    lines.push(
      `For ${dateRangeLabel.toLowerCase()}, ${halau?.name || 'the halau'} collected $${summary.totalCollected.toFixed(2)} in payments across ${summary.transactionCount} transaction${summary.transactionCount !== 1 ? 's' : ''}.`
    );

    if (summary.totalDuesAmount > 0) {
      lines.push(
        `The overall collection rate is ${collectionRate}%, with $${summary.totalPaid.toFixed(2)} collected out of $${summary.totalDuesAmount.toFixed(2)} total dues assessed.`
      );
    }

    if (summary.totalOverdue > 0) {
      lines.push(
        `There are ${summary.statusCounts.overdue} overdue due${summary.statusCounts.overdue !== 1 ? 's' : ''} totaling $${summary.totalOverdue.toFixed(2)} that require attention.`
      );
    } else if (collectionRate >= 80) {
      lines.push(`Collection is on track — no overdue balances flagged for this period.`);
    }

    if (summary.totalExpenses > 0) {
      lines.push(
        `Outgoing expenses (refunds/reimbursements) totaled $${summary.totalExpenses.toFixed(2)}, leaving a net income of $${summary.netIncome.toFixed(2)}.`
      );
    }

    if (summary.memberCount > 0) {
      lines.push(
        `This report covers ${summary.memberCount} member${summary.memberCount !== 1 ? 's' : ''} with ${summary.duesCount} dues record${summary.duesCount !== 1 ? 's' : ''}.`
      );
    }

    return lines.join(' ');
  };

  // Calculate summary with more details
  const summary = useMemo(() => {
    // For transactions: payment = income (dues collected), refund/expense_release = outgoing
    const totalCollected = transactions
      .filter((t) => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.type === 'refund' || t.type === 'expense_release')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDuesAmount = memberDues.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = memberDues
      .filter((d) => d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0);
    const totalPending = memberDues
      .filter((d) => d.status === 'pending' || d.status === 'partial')
      .reduce((sum, d) => sum + (d.amount - (d.amountPaid || 0)), 0);
    const totalOverdue = memberDues
      .filter((d) => d.status === 'overdue')
      .reduce((sum, d) => sum + (d.amount - (d.amountPaid || 0)), 0);

    // Category breakdown for dues
    const duesByCategory: Record<string, { count: number; total: number; paid: number }> = {};
    memberDues.forEach((due) => {
      const cat = due.category || 'Other';
      if (!duesByCategory[cat]) {
        duesByCategory[cat] = { count: 0, total: 0, paid: 0 };
      }
      duesByCategory[cat].count++;
      duesByCategory[cat].total += due.amount;
      duesByCategory[cat].paid += due.amountPaid || 0;
    });

    // Payment method breakdown
    const paymentMethods: Record<string, { count: number; total: number }> = {};
    transactions.filter((t) => t.type === 'payment').forEach((txn) => {
      const method = txn.method || 'Unknown';
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, total: 0 };
      }
      paymentMethods[method].count++;
      paymentMethods[method].total += txn.amount;
    });

    // Member breakdown
    const memberBreakdown: Record<string, { name: string; totalDues: number; totalPaid: number; balance: number }> = {};
    memberDues.forEach((due) => {
      const memberId = due.memberId;
      if (!memberBreakdown[memberId]) {
        memberBreakdown[memberId] = {
          name: getMemberName(memberId),
          totalDues: 0,
          totalPaid: 0,
          balance: 0,
        };
      }
      memberBreakdown[memberId].totalDues += due.amount;
      memberBreakdown[memberId].totalPaid += due.amountPaid || 0;
      memberBreakdown[memberId].balance = memberBreakdown[memberId].totalDues - memberBreakdown[memberId].totalPaid;
    });

    // Status counts
    const statusCounts = {
      paid: memberDues.filter((d) => d.status === 'paid').length,
      pending: memberDues.filter((d) => d.status === 'pending').length,
      partial: memberDues.filter((d) => d.status === 'partial').length,
      overdue: memberDues.filter((d) => d.status === 'overdue').length,
    };

    return {
      totalCollected,
      totalExpenses,
      netIncome: totalCollected - totalExpenses,
      totalDuesAmount,
      totalPaid,
      totalPending,
      totalOverdue,
      memberCount: new Set(memberDues.map((d) => d.memberId)).size,
      transactionCount: transactions.length,
      duesCount: memberDues.length,
      duesByCategory,
      paymentMethods,
      memberBreakdown,
      statusCounts,
    };
  }, [memberDues, transactions]);

  const generateCSV = () => {
    let csv = '';
    const dateRangeLabel = DATE_RANGES.find((d) => d.value === dateRange)?.label || 'All Time';

    // Header
    csv += `FINANCIAL REPORT - ${halau?.name || 'Halau'}\n`;
    csv += `Date Range: ${dateRangeLabel}\n`;
    csv += `Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}\n`;
    csv += `\n`;

    // AI Summary
    if (includeAiSummary) {
      csv += '═══════════════════════════════════════════════════════════════\n';
      csv += 'AI SUMMARY\n';
      csv += '═══════════════════════════════════════════════════════════════\n';
      csv += generateAiSummary() + '\n\n';
    }

    // Summary Section
    if (includeSummary) {
      csv += '═══════════════════════════════════════════════════════════════\n';
      csv += 'EXECUTIVE SUMMARY\n';
      csv += '═══════════════════════════════════════════════════════════════\n\n';

      csv += 'FINANCIAL OVERVIEW\n';
      csv += `Total Income (Payments Received),$${summary.totalCollected.toFixed(2)}\n`;
      csv += `Total Outgoing (Refunds/Expenses),$${summary.totalExpenses.toFixed(2)}\n`;
      csv += `Net Income,$${summary.netIncome.toFixed(2)}\n`;
      csv += `\n`;

      csv += 'DUES OVERVIEW\n';
      csv += `Total Dues Assessed,$${summary.totalDuesAmount.toFixed(2)}\n`;
      csv += `Total Collected,$${summary.totalPaid.toFixed(2)}\n`;
      csv += `Outstanding Balance,$${(summary.totalPending + summary.totalOverdue).toFixed(2)}\n`;
      csv += `Collection Rate,${summary.totalDuesAmount > 0 ? ((summary.totalPaid / summary.totalDuesAmount) * 100).toFixed(1) : 0}%\n`;
      csv += `\n`;

      csv += 'COUNTS\n';
      csv += `Total Members with Dues,${summary.memberCount}\n`;
      csv += `Total Dues Records,${summary.duesCount}\n`;
      csv += `Total Transactions,${summary.transactionCount}\n`;
      csv += `\n`;

      csv += 'DUES BY STATUS\n';
      csv += `Paid,${summary.statusCounts.paid}\n`;
      csv += `Pending,${summary.statusCounts.pending}\n`;
      csv += `Partial,${summary.statusCounts.partial}\n`;
      csv += `Overdue,${summary.statusCounts.overdue}\n`;
      csv += `\n`;

      // Category Breakdown
      if (Object.keys(summary.duesByCategory).length > 0) {
        csv += 'DUES BY CATEGORY\n';
        csv += 'Category,Count,Total Amount,Amount Paid,Outstanding\n';
        Object.entries(summary.duesByCategory).forEach(([category, data]) => {
          csv += `"${category}",${data.count},$${data.total.toFixed(2)},$${data.paid.toFixed(2)},$${(data.total - data.paid).toFixed(2)}\n`;
        });
        csv += `\n`;
      }

      // Payment Method Breakdown
      if (Object.keys(summary.paymentMethods).length > 0) {
        csv += 'PAYMENTS BY METHOD\n';
        csv += 'Method,Count,Total Amount\n';
        Object.entries(summary.paymentMethods).forEach(([method, data]) => {
          csv += `"${method}",${data.count},$${data.total.toFixed(2)}\n`;
        });
        csv += `\n`;
      }

      // Member Balance Summary
      if (Object.keys(summary.memberBreakdown).length > 0) {
        csv += 'MEMBER BALANCE SUMMARY\n';
        csv += 'Member,Total Dues,Total Paid,Outstanding Balance\n';
        Object.values(summary.memberBreakdown)
          .sort((a, b) => b.balance - a.balance)
          .forEach((member) => {
            csv += `"${member.name}",$${member.totalDues.toFixed(2)},$${member.totalPaid.toFixed(2)},$${member.balance.toFixed(2)}\n`;
          });
        csv += `\n`;
      }
    }

    // Detailed Dues Section
    if (includeDues && memberDues.length > 0) {
      csv += '═══════════════════════════════════════════════════════════════\n';
      csv += 'DETAILED DUES RECORDS\n';
      csv += '═══════════════════════════════════════════════════════════════\n\n';
      csv += 'Member,Due Name,Category,Amount Owed,Amount Paid,Balance,Status,Due Date,Paid Date,Notes\n';
      memberDues
        .sort((a, b) => getMemberName(a.memberId).localeCompare(getMemberName(b.memberId)))
        .forEach((due) => {
          const balance = due.amount - (due.amountPaid || 0);
          csv += `"${getMemberName(due.memberId)}","${due.name}","${due.category}",$${due.amount.toFixed(2)},$${(due.amountPaid || 0).toFixed(2)},$${balance.toFixed(2)},${due.status},"${format(parseISO(due.dueDate), 'MM/dd/yyyy')}","${due.paidAt ? format(parseISO(due.paidAt), 'MM/dd/yyyy') : ''}","${due.notes || ''}"\n`;
        });
      csv += `\n`;
    }

    // Detailed Transactions Section
    if (includeTransactions && transactions.length > 0) {
      csv += '═══════════════════════════════════════════════════════════════\n';
      csv += 'DETAILED TRANSACTION RECORDS\n';
      csv += '═══════════════════════════════════════════════════════════════\n\n';
      csv += 'Date,Time,Type,Category,Amount,Payment Method,Member,Processed By,Invoice Number,Reference ID,Notes\n';
      transactions
        .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
        .forEach((txn) => {
          const processedByName = getMemberName(txn.processedBy);
          csv += `"${format(parseISO(txn.processedAt), 'MM/dd/yyyy')}","${format(parseISO(txn.processedAt), 'h:mm a')}",${txn.type},"${txn.category}",$${txn.amount.toFixed(2)},"${txn.method || 'N/A'}","${txn.memberId ? getMemberName(txn.memberId) : 'N/A'}","${processedByName}","${txn.invoiceNumber || ''}","${txn.reference || ''}","${txn.notes || ''}"\n`;
        });
    }

    return csv;
  };

  const generateHTML = () => {
    const dateRangeLabel = DATE_RANGES.find((d) => d.value === dateRange)?.label || 'All Time';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Financial Report - ${halau?.name || 'Halau'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; font-size: 14px; }
          h1 { color: ${theme.primary}; margin-bottom: 5px; font-size: 28px; }
          h2 { color: #333; margin-top: 35px; margin-bottom: 15px; border-bottom: 2px solid ${theme.primary}; padding-bottom: 8px; font-size: 18px; }
          h3 { color: #555; margin-top: 25px; margin-bottom: 12px; font-size: 15px; }
          .subtitle { color: #666; margin-bottom: 25px; font-size: 13px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
          .summary-card { background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid ${theme.primary}; }
          .summary-card.success { border-left-color: #10B981; }
          .summary-card.danger { border-left-color: #EF4444; }
          .summary-card.warning { border-left-color: #F59E0B; }
          .summary-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .summary-value { font-size: 22px; font-weight: bold; color: #1a1a1a; margin-top: 4px; }
          .summary-value.positive { color: #10B981; }
          .summary-value.negative { color: #EF4444; }
          .stats-row { display: flex; gap: 30px; margin: 15px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; }
          .stat-item { text-align: center; }
          .stat-number { font-size: 24px; font-weight: bold; color: ${theme.primary}; }
          .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th { background: ${theme.primary}; color: white; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 9px 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #fafafa; }
          tr:hover { background: #f0f0f0; }
          .status { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; display: inline-block; }
          .status-paid { background: #D1FAE5; color: #059669; }
          .status-pending { background: #FEF3C7; color: #D97706; }
          .status-overdue { background: #FEE2E2; color: #DC2626; }
          .status-partial { background: #DBEAFE; color: #2563EB; }
          .status-approved { background: #D1FAE5; color: #059669; }
          .amount { font-family: 'SF Mono', Monaco, Consolas, monospace; }
          .amount.positive { color: #10B981; }
          .amount.negative { color: #EF4444; }
          .breakdown-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 15px 0; }
          .breakdown-section { background: #f8f9fa; padding: 15px; border-radius: 8px; }
          .breakdown-title { font-weight: 600; margin-bottom: 10px; color: #333; }
          .breakdown-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
          .breakdown-item:last-child { border-bottom: none; }
          .text-muted { color: #999; font-size: 11px; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 11px; text-align: center; }
          .page-break { page-break-before: always; }
          @media print {
            body { padding: 20px; }
            .summary-grid { grid-template-columns: repeat(2, 1fr); }
          }
        </style>
      </head>
      <body>
        <h1>Financial Report</h1>
        <p class="subtitle">${halau?.name || 'Halau'} • ${dateRangeLabel} • Generated ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
    `;

    // AI Summary Section
    if (includeAiSummary) {
      html += `
        <div style="background:#f0f9ff;border-left:4px solid #0EA5E9;padding:16px 20px;border-radius:8px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;margin-bottom:8px;">
            <span style="font-size:14px;font-weight:600;color:#0EA5E9;">AI Summary</span>
          </div>
          <p style="margin:0;color:#334155;line-height:1.6;font-size:14px;">${generateAiSummary()}</p>
        </div>
      `;
    }

    // Executive Summary Section
    if (includeSummary) {
      const collectionRate = summary.totalDuesAmount > 0 ? ((summary.totalPaid / summary.totalDuesAmount) * 100).toFixed(1) : '0';

      html += `
        <h2>Executive Summary</h2>

        <div class="summary-grid">
          <div class="summary-card success">
            <div class="summary-label">Total Income</div>
            <div class="summary-value positive">$${summary.totalCollected.toFixed(2)}</div>
          </div>
          <div class="summary-card danger">
            <div class="summary-label">Total Outgoing</div>
            <div class="summary-value negative">$${summary.totalExpenses.toFixed(2)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Net Income</div>
            <div class="summary-value ${summary.netIncome >= 0 ? 'positive' : 'negative'}">$${summary.netIncome.toFixed(2)}</div>
          </div>
          <div class="summary-card warning">
            <div class="summary-label">Outstanding</div>
            <div class="summary-value">$${(summary.totalPending + summary.totalOverdue).toFixed(2)}</div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-number">${summary.memberCount}</div>
            <div class="stat-label">Members</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${summary.duesCount}</div>
            <div class="stat-label">Dues Records</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${summary.transactionCount}</div>
            <div class="stat-label">Transactions</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${collectionRate}%</div>
            <div class="stat-label">Collection Rate</div>
          </div>
        </div>

        <h3>Dues by Status</h3>
        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-number" style="color: #059669;">${summary.statusCounts.paid}</div>
            <div class="stat-label">Paid</div>
          </div>
          <div class="stat-item">
            <div class="stat-number" style="color: #D97706;">${summary.statusCounts.pending}</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat-item">
            <div class="stat-number" style="color: #2563EB;">${summary.statusCounts.partial}</div>
            <div class="stat-label">Partial</div>
          </div>
          <div class="stat-item">
            <div class="stat-number" style="color: #DC2626;">${summary.statusCounts.overdue}</div>
            <div class="stat-label">Overdue</div>
          </div>
        </div>

        <div class="breakdown-grid">
      `;

      // Category Breakdown
      if (Object.keys(summary.duesByCategory).length > 0) {
        html += `
          <div class="breakdown-section">
            <div class="breakdown-title">Dues by Category</div>
        `;
        Object.entries(summary.duesByCategory).forEach(([category, data]) => {
          html += `
            <div class="breakdown-item">
              <span>${category}</span>
              <span class="amount">$${data.total.toFixed(2)} <span class="text-muted">(${data.count})</span></span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Payment Method Breakdown
      if (Object.keys(summary.paymentMethods).length > 0) {
        html += `
          <div class="breakdown-section">
            <div class="breakdown-title">Payments by Method</div>
        `;
        Object.entries(summary.paymentMethods).forEach(([method, data]) => {
          html += `
            <div class="breakdown-item">
              <span>${method.charAt(0).toUpperCase() + method.slice(1)}</span>
              <span class="amount">$${data.total.toFixed(2)} <span class="text-muted">(${data.count})</span></span>
            </div>
          `;
        });
        html += `</div>`;
      }

      html += `</div>`;

      // Member Balance Summary
      if (Object.keys(summary.memberBreakdown).length > 0) {
        html += `
          <h3>Member Balance Summary</h3>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th style="text-align: right;">Total Dues</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Outstanding</th>
              </tr>
            </thead>
            <tbody>
        `;
        Object.values(summary.memberBreakdown)
          .sort((a, b) => b.balance - a.balance)
          .forEach((member) => {
            html += `
              <tr>
                <td>${member.name}</td>
                <td class="amount" style="text-align: right;">$${member.totalDues.toFixed(2)}</td>
                <td class="amount positive" style="text-align: right;">$${member.totalPaid.toFixed(2)}</td>
                <td class="amount ${member.balance > 0 ? 'negative' : ''}" style="text-align: right;">$${member.balance.toFixed(2)}</td>
              </tr>
            `;
          });
        html += `</tbody></table>`;
      }
    }

    // Detailed Dues Section
    if (includeDues && memberDues.length > 0) {
      html += `
        <h2 class="page-break">Detailed Dues Records (${memberDues.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Due Name</th>
              <th>Category</th>
              <th style="text-align: right;">Amount</th>
              <th style="text-align: right;">Paid</th>
              <th style="text-align: right;">Balance</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Paid Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
      `;
      memberDues
        .sort((a, b) => getMemberName(a.memberId).localeCompare(getMemberName(b.memberId)))
        .forEach((due) => {
          const statusClass = `status-${due.status}`;
          const balance = due.amount - (due.amountPaid || 0);
          html += `
            <tr>
              <td>${getMemberName(due.memberId)}</td>
              <td>${due.name}</td>
              <td>${due.category}</td>
              <td class="amount" style="text-align: right;">$${due.amount.toFixed(2)}</td>
              <td class="amount positive" style="text-align: right;">$${(due.amountPaid || 0).toFixed(2)}</td>
              <td class="amount ${balance > 0 ? 'negative' : ''}" style="text-align: right;">$${balance.toFixed(2)}</td>
              <td><span class="status ${statusClass}">${due.status.charAt(0).toUpperCase() + due.status.slice(1)}</span></td>
              <td>${format(parseISO(due.dueDate), 'MMM d, yyyy')}</td>
              <td>${due.paidAt ? format(parseISO(due.paidAt), 'MMM d, yyyy') : '—'}</td>
              <td class="text-muted">${due.notes || '—'}</td>
            </tr>
          `;
        });
      html += `</tbody></table>`;
    }

    // Detailed Transactions Section
    if (includeTransactions && transactions.length > 0) {
      html += `
        <h2 class="page-break">Detailed Transaction Records (${transactions.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Type</th>
              <th>Category</th>
              <th style="text-align: right;">Amount</th>
              <th>Method</th>
              <th>Member</th>
              <th>Processed By</th>
              <th>Invoice #</th>
              <th>Reference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
      `;
      transactions
        .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
        .forEach((txn) => {
          const typeColor = txn.type === 'payment' ? 'positive' : 'negative';
          const typeLabel = txn.type === 'payment' ? 'Payment' : txn.type === 'refund' ? 'Refund' : 'Expense Release';
          html += `
            <tr>
              <td>${format(parseISO(txn.processedAt), 'MMM d, yyyy')}<br><span class="text-muted">${format(parseISO(txn.processedAt), 'h:mm a')}</span></td>
              <td><span class="status status-${txn.type === 'payment' ? 'paid' : 'overdue'}">${typeLabel}</span></td>
              <td>${txn.category}</td>
              <td class="amount ${typeColor}" style="text-align: right;">${txn.type === 'payment' ? '+' : '-'}$${txn.amount.toFixed(2)}</td>
              <td>${txn.method ? txn.method.charAt(0).toUpperCase() + txn.method.slice(1) : '—'}</td>
              <td>${txn.memberId ? getMemberName(txn.memberId) : '—'}</td>
              <td>${getMemberName(txn.processedBy)}</td>
              <td class="text-muted">${txn.invoiceNumber || '—'}</td>
              <td class="text-muted">${txn.reference || '—'}</td>
              <td class="text-muted">${txn.notes || '—'}</td>
            </tr>
          `;
        });
      html += `</tbody></table>`;
    }

    html += `
        <div class="footer">
          <p>This financial report was generated automatically on ${format(new Date(), 'MMMM d, yyyy')} at ${format(new Date(), 'h:mm a')}.</p>
          <p>For questions about this report, please contact your halau administrator.</p>
        </div>
      </body>
      </html>
    `;

    return html;
  };

  const handleExport = async () => {
    if (!includeDues && !includeTransactions && !includeSummary) {
      Alert.alert('Error', 'Please select at least one section to export');
      return;
    }

    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const halauName = (halau?.name || 'halau').replace(/[^a-zA-Z0-9]/g, '_');

      if (selectedFormat === 'excel') {
        // Export as CSV (Excel-compatible)
        const csv = generateCSV();

        if (Platform.OS === 'web') {
          // For web, create a blob and download directly
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${halauName}_financials_${dateStr}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          Alert.alert('Success', 'CSV file downloaded');
        } else {
          const fileName = `${halauName}_financials_${dateStr}.csv`;
          const filePath = `${FileSystem.documentDirectory}${fileName}`;

          await FileSystem.writeAsStringAsync(filePath, csv, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filePath, {
              mimeType: 'text/csv',
              dialogTitle: 'Export Financial Data',
              UTI: 'public.comma-separated-values-text',
            });
          } else {
            Alert.alert('Success', 'File saved to device');
          }
        }
      } else {
        // Export as PDF
        const html = generateHTML();

        if (Platform.OS === 'web') {
          // For web, open print dialog with the HTML content
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.print();
          } else {
            Alert.alert('Error', 'Please allow popups to export PDF');
          }
        } else {
          const result = await Print.printToFileAsync({
            html,
            base64: false,
          });

          if (result?.uri) {
            const fileName = `${halauName}_financials_${dateStr}.pdf`;
            const newUri = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.moveAsync({ from: result.uri, to: newUri });

            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(newUri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Export Financial Report',
                UTI: 'com.adobe.pdf',
              });
            } else {
              Alert.alert('Success', 'PDF saved to device');
            }
          } else {
            Alert.alert('Error', 'Failed to generate PDF');
          }
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedDateLabel = DATE_RANGES.find((d) => d.value === dateRange)?.label || 'All Time';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-slate-50')}>
        {/* Header */}
        <View
          className={cn('px-5 pb-4 border-b', isDark ? 'bg-black border-slate-800' : 'bg-white border-slate-200')}
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="flex-row items-center">
            <BackButton />
            <Text className={cn('text-xl font-bold ml-2', isDark ? 'text-white' : 'text-slate-900')}>
              Export Financials
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
        >
          {/* Format Selection */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Export Format
            </Text>
            <View className="flex-row gap-3 mb-6">
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedFormat('excel');
                }}
                className={cn(
                  'flex-1 p-4 rounded-xl border-2',
                  selectedFormat === 'excel'
                    ? 'border-green-500'
                    : isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
                )}
                style={selectedFormat === 'excel' ? { backgroundColor: isDark ? '#064E3B15' : '#D1FAE515' } : undefined}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <FileSpreadsheet size={24} color="#10B981" />
                  {selectedFormat === 'excel' && (
                    <View className="w-5 h-5 rounded-full bg-green-500 items-center justify-center">
                      <Check size={14} color="white" />
                    </View>
                  )}
                </View>
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  Excel (CSV)
                </Text>
                <Text className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-500')}>
                  Spreadsheet format
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedFormat('pdf');
                }}
                className={cn(
                  'flex-1 p-4 rounded-xl border-2',
                  selectedFormat === 'pdf'
                    ? 'border-red-500'
                    : isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
                )}
                style={selectedFormat === 'pdf' ? { backgroundColor: isDark ? '#7F1D1D15' : '#FEE2E215' } : undefined}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <FileText size={24} color="#EF4444" />
                  {selectedFormat === 'pdf' && (
                    <View className="w-5 h-5 rounded-full bg-red-500 items-center justify-center">
                      <Check size={14} color="white" />
                    </View>
                  )}
                </View>
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  PDF
                </Text>
                <Text className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-500')}>
                  Formatted report
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Date Range */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Date Range
            </Text>
            <Pressable
              onPress={() => setShowDatePicker(!showDatePicker)}
              className={cn(
                'p-4 rounded-xl border mb-2',
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Calendar size={20} color={theme.primary} />
                  <Text className={cn('ml-3 font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                    {selectedDateLabel}
                  </Text>
                </View>
                <ChevronDown size={20} color={isDark ? '#64748B' : '#94A3B8'} />
              </View>
            </Pressable>

            {showDatePicker && (
              <Animated.View
                entering={FadeIn.duration(200)}
                className={cn('rounded-xl border overflow-hidden mb-4', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}
              >
                {DATE_RANGES.map((range) => (
                  <Pressable
                    key={range.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDateRange(range.value);
                      setShowDatePicker(false);
                    }}
                    className={cn(
                      'px-4 py-3 flex-row items-center justify-between border-b',
                      isDark ? 'border-slate-800' : 'border-slate-100',
                      range.value === dateRange && (isDark ? 'bg-slate-800' : 'bg-slate-50')
                    )}
                  >
                    <Text className={cn('font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                      {range.label}
                    </Text>
                    {range.value === dateRange && <Check size={18} color={theme.primary} />}
                  </Pressable>
                ))}
              </Animated.View>
            )}
          </Animated.View>

          {/* Include Sections */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)} className="mt-4">
            <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Include in Export
            </Text>
            <View className={cn('rounded-xl border overflow-hidden', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setIncludeSummary(!includeSummary);
                }}
                className={cn('px-4 py-3.5 flex-row items-center justify-between border-b', isDark ? 'border-slate-800' : 'border-slate-100')}
              >
                <View className="flex-row items-center">
                  <DollarSign size={20} color={theme.primary} />
                  <Text className={cn('ml-3 font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                    Financial Summary
                  </Text>
                </View>
                <View className={cn('w-6 h-6 rounded-md items-center justify-center', includeSummary ? '' : isDark ? 'bg-slate-800' : 'bg-slate-100')} style={includeSummary ? { backgroundColor: theme.primary } : undefined}>
                  {includeSummary && <Check size={16} color="white" />}
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setIncludeDues(!includeDues);
                }}
                className={cn('px-4 py-3.5 flex-row items-center justify-between border-b', isDark ? 'border-slate-800' : 'border-slate-100')}
              >
                <View className="flex-row items-center">
                  <Users size={20} color={theme.primary} />
                  <View className="ml-3">
                    <Text className={cn('font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                      Member Dues
                    </Text>
                    <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-500')}>
                      {memberDues.length} records
                    </Text>
                  </View>
                </View>
                <View className={cn('w-6 h-6 rounded-md items-center justify-center', includeDues ? '' : isDark ? 'bg-slate-800' : 'bg-slate-100')} style={includeDues ? { backgroundColor: theme.primary } : undefined}>
                  {includeDues && <Check size={16} color="white" />}
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setIncludeTransactions(!includeTransactions);
                }}
                className={cn('px-4 py-3.5 flex-row items-center justify-between border-b', isDark ? 'border-slate-800' : 'border-slate-100')}
              >
                <View className="flex-row items-center">
                  <FileText size={20} color={theme.primary} />
                  <View className="ml-3">
                    <Text className={cn('font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                      Transactions
                    </Text>
                    <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-500')}>
                      {transactions.length} records
                    </Text>
                  </View>
                </View>
                <View className={cn('w-6 h-6 rounded-md items-center justify-center', includeTransactions ? '' : isDark ? 'bg-slate-800' : 'bg-slate-100')} style={includeTransactions ? { backgroundColor: theme.primary } : undefined}>
                  {includeTransactions && <Check size={16} color="white" />}
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setIncludeAiSummary(!includeAiSummary);
                }}
                className="px-4 py-3.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center">
                  <Sparkles size={20} color="#0EA5E9" />
                  <View className="ml-3">
                    <Text className={cn('font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                      AI Summary
                    </Text>
                    <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-500')}>
                      3–5 sentence insights
                    </Text>
                  </View>
                </View>
                <View className={cn('w-6 h-6 rounded-md items-center justify-center', includeAiSummary ? '' : isDark ? 'bg-slate-800' : 'bg-slate-100')} style={includeAiSummary ? { backgroundColor: '#0EA5E9' } : undefined}>
                  {includeAiSummary && <Check size={16} color="white" />}
                </View>
              </Pressable>
            </View>
          </Animated.View>

          {/* Preview Stats */}
          <Animated.View entering={FadeInUp.delay(400).duration(400)} className="mt-6">
            <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Preview
            </Text>
            <View className={cn('rounded-xl p-4 border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
              <View className="flex-row justify-between mb-3">
                <Text className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>Total Income</Text>
                <Text className={cn('font-semibold text-green-500')}>${summary.totalCollected.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between mb-3">
                <Text className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>Total Expenses</Text>
                <Text className={cn('font-semibold text-red-500')}>${summary.totalExpenses.toFixed(2)}</Text>
              </View>
              <View className={cn('h-px my-2', isDark ? 'bg-slate-800' : 'bg-slate-100')} />
              <View className="flex-row justify-between">
                <Text className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-slate-900')}>Net Income</Text>
                <Text className={cn('font-bold', summary.netIncome >= 0 ? 'text-green-500' : 'text-red-500')}>
                  ${summary.netIncome.toFixed(2)}
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Export Button */}
        <View
          className={cn('px-5 py-4 border-t', isDark ? 'bg-black border-slate-800' : 'bg-white border-slate-200')}
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Pressable
            onPress={handleExport}
            disabled={isExporting}
            className={cn(
              'py-4 rounded-xl flex-row items-center justify-center',
              isExporting && 'opacity-70'
            )}
            style={{ backgroundColor: theme.primary }}
          >
            {isExporting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Download size={20} color="white" />
                <Text className="text-white font-semibold text-base ml-2">
                  Export as {selectedFormat === 'excel' ? 'Excel' : 'PDF'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}
