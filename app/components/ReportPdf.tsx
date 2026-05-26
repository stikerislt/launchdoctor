import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  title: { fontSize: 24, marginBottom: 10, fontWeight: "bold" },
  subtitle: { fontSize: 14, marginBottom: 20, color: "#616161" },
  score: { fontSize: 48, fontWeight: "bold", marginBottom: 20 },
  section: { marginBottom: 16 },
  findingTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  findingBody: { fontSize: 11, marginBottom: 8, color: "#333" },
  step: { fontSize: 10, marginLeft: 12, marginBottom: 2 },
});

interface ReportPdfProps {
  shopName: string;
  launchScore: number;
  findings: Array<{
    severity: string;
    title: string;
    body: string;
    fixSteps: string[] | unknown;
  }>;
}

export function ReportPdfDocument({ shopName, launchScore, findings }: ReportPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Launch Doctor Audit Report</Text>
        <Text style={styles.subtitle}>{shopName}</Text>
        <Text style={styles.score}>Launch Score: {launchScore}/100</Text>
        <Text style={styles.subtitle}>{findings.length} findings</Text>

        {findings.map((f, i) => {
          const steps = Array.isArray(f.fixSteps) ? f.fixSteps as string[] : [];
          return (
            <View key={i} style={styles.section} wrap={false}>
              <Text style={styles.findingTitle}>
                [{f.severity}] {f.title}
              </Text>
              <Text style={styles.findingBody}>{f.body}</Text>
              {steps.map((step, j) => (
                <Text key={j} style={styles.step}>{j + 1}. {step}</Text>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
