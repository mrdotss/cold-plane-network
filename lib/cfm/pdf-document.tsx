import "server-only";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type DocumentProps,
} from "@react-pdf/renderer";
import type {
  CfmScan,
  CfmAccount,
  CfmRecommendation,
  CfmServiceBreakdown,
} from "./types";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  subtitle: { fontSize: 12, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 130, fontWeight: "bold" },
  value: { flex: 1 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#4472C4",
    color: "#FFFFFF",
    fontWeight: "bold",
    padding: 4,
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    padding: 3,
    fontSize: 8,
  },
  tableRowCritical: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCCCCC",
    padding: 3,
    fontSize: 8,
    backgroundColor: "#FCE4EC",
  },
  col1: { width: "12%" },
  col2: { width: "15%" },
  col3: { width: "35%" },
  col4: { width: "15%", textAlign: "right" },
  col5: { width: "10%", textAlign: "center" },
  svcCol1: { width: "25%" },
  svcCol2: { width: "25%", textAlign: "right" },
  svcCol3: { width: "25%", textAlign: "right" },
  svcCol4: { width: "25%", textAlign: "right" },
});

function formatCurrency(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PdfProps {
  scan: CfmScan;
  account: CfmAccount;
  recommendations: CfmRecommendation[];
}

function CfmPdfDocument({ scan, account, recommendations }: PdfProps) {
  const summary = scan.summary;
  const totalSpend = summary?.totalMonthlySpend ?? 0;
  const totalSavings = summary?.totalPotentialSavings ?? 0;
  const savingsPct = totalSpend > 0 ? ((totalSavings / totalSpend) * 100).toFixed(1) : "0.0";
  const scanDate = scan.completedAt
    ? new Date(scan.completedAt).toISOString().split("T")[0]
    : "N/A";

  const breakdowns = summary?.serviceBreakdown ?? [];
  const top10 = [...recommendations]
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
    .slice(0, 10);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>CFM Analysis Report</Text>

        {/* Account Details */}
        <View style={styles.row}>
          <Text style={styles.label}>Account Name:</Text>
          <Text style={styles.value}>{account.accountName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>AWS Account ID:</Text>
          <Text style={styles.value}>{account.awsAccountId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Regions:</Text>
          <Text style={styles.value}>{account.regions.join(", ")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Scan Date:</Text>
          <Text style={styles.value}>{scanDate}</Text>
        </View>

        {/* Financial Summary */}
        <View style={styles.row}>
          <Text style={styles.label}>Monthly Spend:</Text>
          <Text style={styles.value}>{formatCurrency(totalSpend)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Potential Savings:</Text>
          <Text style={styles.value}>{formatCurrency(totalSavings)} ({savingsPct}%)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Recommendations:</Text>
          <Text style={styles.value}>{summary?.recommendationCount ?? recommendations.length}</Text>
        </View>

        {/* Service Breakdown */}
        <Text style={styles.subtitle}>Savings by Service</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.svcCol1}>Service</Text>
          <Text style={styles.svcCol2}>Current Spend</Text>
          <Text style={styles.svcCol3}>Potential Savings</Text>
          <Text style={styles.svcCol4}>Recommendations</Text>
        </View>
        {breakdowns.map((svc: CfmServiceBreakdown) => (
          <View key={svc.service} style={styles.tableRow}>
            <Text style={styles.svcCol1}>{svc.service}</Text>
            <Text style={styles.svcCol2}>{formatCurrency(svc.currentSpend)}</Text>
            <Text style={styles.svcCol3}>{formatCurrency(svc.potentialSavings)}</Text>
            <Text style={styles.svcCol4}>{svc.recommendationCount}</Text>
          </View>
        ))}

        {/* Top 10 Recommendations */}
        <Text style={styles.subtitle}>Top 10 Recommendations</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Priority</Text>
          <Text style={styles.col2}>Service</Text>
          <Text style={styles.col3}>Recommendation</Text>
          <Text style={styles.col4}>Savings</Text>
          <Text style={styles.col5}>Effort</Text>
        </View>
        {top10.map((rec) => (
          <View
            key={rec.id}
            style={rec.priority === "critical" ? styles.tableRowCritical : styles.tableRow}
          >
            <Text style={styles.col1}>{rec.priority}</Text>
            <Text style={styles.col2}>{rec.service}</Text>
            <Text style={styles.col3}>{rec.recommendation}</Text>
            <Text style={styles.col4}>{formatCurrency(rec.estimatedSavings)}</Text>
            <Text style={styles.col5}>{rec.effort}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

/**
 * Create the PDF document React element for rendering.
 * Separated from the render call so the component can be tested independently.
 */
export function createPdfDocument(
  scan: CfmScan,
  account: CfmAccount,
  recommendations: CfmRecommendation[],
): React.ReactElement<DocumentProps> {
  return (
    <CfmPdfDocument
      scan={scan}
      account={account}
      recommendations={recommendations}
    />
  );
}
