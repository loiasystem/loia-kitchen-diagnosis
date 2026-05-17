import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer
} from "recharts";

export default function FlavorRadar({ scores, previousScores }) {
    const data = [
        { subject: "짠맛", value: scores?.salty || 0, previousValue: previousScores?.salty || 0 },
        { subject: "감칠맛", value: scores?.umami || 0, previousValue: previousScores?.umami || 0 },
        { subject: "산미", value: scores?.acid || 0, previousValue: previousScores?.acid || 0 },
        { subject: "단맛", value: scores?.sweet || 0, previousValue: previousScores?.sweet || 0 },
        { subject: "쓴맛", value: scores?.bitter || 0, previousValue: previousScores?.bitter || 0 },
        { subject: "매운맛", value: scores?.heat || 0, previousValue: previousScores?.heat || 0 },
        { subject: "허브", value: scores?.herb || 0, previousValue: previousScores?.herb || 0 },
        { subject: "향신료", value: scores?.spice || 0, previousValue: previousScores?.spice || 0 },
        { subject: "지방", value: scores?.lipid || 0, previousValue: previousScores?.lipid || 0 },
        { subject: "식감", value: scores?.texture || 0, previousValue: previousScores?.texture || 0 }
    ];

    const hasPrevious = !!previousScores;

    return (
        <div style={{ width: "100%", height: "420px" }}>
            <div style={{ width: "100%", height: "360px" }}>
                <ResponsiveContainer>
                    <RadarChart data={data}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: "#9a9084" }}
                        />
                        {hasPrevious && (
                            <Radar
                                name="이전 진단"
                                dataKey="previousValue"
                                stroke="#7a746b"
                                strokeWidth={0.1}
                                fill="#373636"
                                fillOpacity={0.4}
                            />
                        )}

                        <Radar
                            name="현재 진단"
                            dataKey="value"
                            stroke="#1f1a14"
                            strokeWidth={0.15}
                            fill="#ffdb4b"
                            fillOpacity={0.5}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "18px",
                    fontSize: "12px",
                    color: "#5f574d",
                    marginTop: "4px"
                }}
            >

                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span
                        style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "999px",
                            background: "#ffd45b",
                            display: "inline-block"
                        }}
                    />
                    현재 진단
                </span>
                {hasPrevious && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span
                            style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "999px",
                                background: "#73736f",
                                display: "inline-block"
                            }}
                        />
                        이전 진단
                    </span>
                )}
            </div>
        </div>
    );
}