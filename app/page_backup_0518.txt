"use client";

import { useEffect, useMemo, useState } from "react";
import recommendationItems from "@/data/recommendation_items.json";
import FlavorRadar from "./components/FlavorRadar";

type DiagnosisResult = {
  kitchenType: string;
  scores?: any;
  strongAxes: string[];
  supportingAxes: string[];
  weakAxes: string[];
  recommendation: string[];
  summary: string;
};

type RecommendationItem = {
  axisCode: string;
  axisName: string;
  itemName: string;
  naverKeyword: string;
  coupangKeyword: string;
  tossKeyword: string;
  priorityRank: number;
  affiliateUrl: string;
  note: string;
};

type ShoppingItem = {
  title: string;
  link: string;
  image: string;
  lprice: string;
  mallName: string;
  productId: string;
};

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [savedResult, setSavedResult] = useState<DiagnosisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ingredientInput, setIngredientInput] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [shoppingResults, setShoppingResults] = useState<
    Record<string, ShoppingItem[]>
  >({});
  useEffect(() => {
    const saved = localStorage.getItem("loia_last_result");

    if (saved) {
      setSavedResult(JSON.parse(saved));
    }
  }, []);

  const history =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("loia_history") || "[]")
      : [];

  const previousResult =
    history.length >= 2
      ? history[history.length - 2]
      : null;

  const ingredientCount =
    result?.summary
      ?.split("찾은 재료:")[1]
      ?.split("찾지 못한 재료:")[0]
      ?.split(",").length || 1;

  const flavorLevel =
    Math.min(
      10,
      Math.max(
        1,
        Math.floor(ingredientCount / 2)
      )
    );

  const levelTitle =
    flavorLevel <= 2
      ? "기본 조미형"
      : flavorLevel <= 4
        ? "균형 확장형"
        : flavorLevel <= 6
          ? "향미 탐색형"
          : flavorLevel <= 8
            ? "Flavor Builder"
            : "Flavor Architect";

  const flavorTitle =
    result?.strongAxes?.includes("100 Umami / 감칠맛")
      ? "Umami Builder"
      : result?.strongAxes?.includes("600 Herb / 허브")
        ? "Herb Explorer"
        : result?.strongAxes?.includes("500 Heat / 매운맛")
          ? "Heat Collector"
          : result?.strongAxes?.includes("700 Spice / 향신료")
            ? "Spice Architect"
            : "Flavor Seeker";

  const flavorDiffs =
    previousResult?.scores && result?.scores
      ? [
        {
          label: "짠맛",
          diff:
            result.scores.salty -
            previousResult.scores.salty
        },
        {
          label: "감칠맛",
          diff:
            result.scores.umami -
            previousResult.scores.umami
        },
        {
          label: "산미",
          diff:
            result.scores.acid -
            previousResult.scores.acid
        },
        {
          label: "매운맛",
          diff:
            result.scores.heat -
            previousResult.scores.heat
        },
        {
          label: "허브",
          diff:
            result.scores.herb -
            previousResult.scores.herb
        }
      ]
      : [];

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setImagePreview(imageUrl);
    setSelectedImageFile(file);
    setResult(null);
  }

  async function handleAnalyze() {
    if (!selectedImageFile && ingredientInput.trim() === "") {
      alert("양념장 사진을 업로드하거나, 가지고 있는 양념명을 입력해주세요.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      const normalizedIngredients = ingredientInput
        .replace(/[.\n\/]/g, ",")
        .replace(/,+/g, ",")
        .trim();

      formData.append("ingredients", normalizedIngredients);

      if (selectedImageFile) {
        formData.append("image", selectedImageFile);
      }
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const serverResult: DiagnosisResult = await response.json();

      setResult(serverResult);
      const history = JSON.parse(
        localStorage.getItem("loia_history") || "[]"
      );

      history.push(serverResult);

      localStorage.setItem(
        "loia_history",
        JSON.stringify(history)
      );

      localStorage.setItem(
        "loia_last_result",
        JSON.stringify(serverResult)
      );
      console.log(serverResult);
    } catch (error) {
      alert("진단 중 오류가 발생했습니다. 다시 시도해주세요.");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const weakAxisCodes = useMemo(() => {
    return result?.weakAxes?.map((axis) => axis.slice(0, 3)) ?? [];
  }, [result]);

  const recommendedItems = useMemo(() => {
    return (recommendationItems as RecommendationItem[])
      .filter((item) => weakAxisCodes.includes(item.axisCode))
      .sort((a, b) => a.priorityRank - b.priorityRank);
  }, [weakAxisCodes]);

  useEffect(() => {
    if (recommendedItems.length === 0) return;

    const fetchShoppingResults = async () => {
      const nextResults: Record<string, ShoppingItem[]> = {};

      for (const item of recommendedItems.slice(0, 6)) {
        try {
          const response = await fetch(
            `/api/shopping?query=${encodeURIComponent(item.naverKeyword)}`
          );

          if (!response.ok) continue;

          const data = await response.json();
          nextResults[item.itemName] = data.items ?? [];
        } catch (error) {
          console.log("쇼핑 데이터를 불러오지 못했습니다.", error);
        }
      }

      setShoppingResults(nextResults);
    };

    fetchShoppingResults();
  }, [recommendedItems]);


  const normalizedScores = result?.scores
    ? (() => {
      const values = Object.values(result.scores);
      const max = Math.max(
        ...(values as number[]),
        1
      );

      return Object.fromEntries(
        Object.entries(result.scores).map(
          ([key, value]) => [
            key,
            Math.round((Number(value) / max) * 100),
          ]
        )
      );
    })()
    : {};

  const flavorSpectrum = result?.scores
    ? (() => {
      const values = Object.values(result.scores).map(Number);

      const average =
        values.reduce((a, b) => a + b, 0) / values.length;

      const variance =
        values.reduce(
          (sum, value) => sum + Math.pow(value - average, 2),
          0
        ) / values.length;

      const balanceScore = Math.max(
        0,
        10 - variance / 200
      );

      return balanceScore.toFixed(1);
    })()
    : "0.0";

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1f1a14]">

      <header className="sticky top-0 z-50 border-b border-[#ded5c8] bg-[#f4efe6]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">

          <div>
            <p className="text-3xl font-semibold tracking-[0.12em]">
              LOIA
            </p>

            <p className="text-[10px] tracking-[0.25em] text-[#7a746b]">
              KITCHEN DIAGNOSIS
            </p>
          </div>

          <button
            onClick={() => {
              setResult(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="rounded-full border border-[#1f1a14] px-5 py-2 text-sm font-medium hover:bg-[#1f1a14] hover:text-white transition-colors duration-200"
          >
            다시 진단하기
          </button>

        </div>
      </header>

      <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 pt-8 pb-52">

        {!result ? (
          <>
            <header className="mb-12">
              <p className="mb-3 text-sm uppercase tracking-[0.35em] text-neutral-500">
                LOIA Kitchen Diagnosis
              </p>

              <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
                우리 집 양념장은
                <br />
                어떤 맛 구조일까?
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f574d]">
                가지고 있는 양념을 입력하거나 양념 선반 사진을 올리면
                우리 집 맛이 어디로 치우쳤는지 보여줍니다.
              </p>
            </header>
            <div className="mx-auto max-w-2xl">
              <section className="rounded-3xl border border-[#ded5c8] bg-white/70/70 p-6 shadow-2xl">
                <h2 className="mb-4 text-xl font-medium">1. 사진 업로드</h2>
                <div className="mb-5">
                  <label className="mb-2 block text-sm text-neutral-400">
                    사진이 없거나, 사진에서 잘 안 보이는 양념은 직접 입력해주세요
                  </label>
                  <textarea
                    value={ingredientInput}
                    onChange={(event) => setIngredientInput(event.target.value)}
                    placeholder="예: 간장, 고춧가루, 참기름, 굴소스, 식초"
                    className="min-h-24 w-full rounded-2xl border border-neutral-800 bg-white p-4 text-[#1f1a14] outline-none placeholder:text-[#9a9084] focus:border-neutral-500"
                  />
                </div>

                <label className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#ded5c8] bg-[#f8f4ec] p-6 text-center hover:border-[#b9aa98]">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="업로드한 양념장 사진"
                      className="max-h-72 rounded-2xl object-contain"
                    />
                  ) : (
                    <div>
                      <p className="text-lg font-medium">양념장 사진 선택</p>
                      <p className="mt-2 text-sm text-neutral-500">
                        양념병 이름이나 라벨이 보이도록 밝은 곳에서 촬영해주세요.<br />
                        사진이 흐리거나 라벨이 가려져 있으면 일부 양념을 인식하지 못할 수 있습니다.
                      </p>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="mt-6 w-full rounded-2xl border border-[#1f1a14] bg-neutral-100 px-5 py-4 font-semibold text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAnalyzing ? "분석 중..." : "내 양념장 진단 시작하기"}
                </button>

              </section>
            </div>
          </>
        ) : (

          <section className="mx-auto max-w-5xl rounded-3xl border border-[#ded5c8] bg-white/70 p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-medium">2. 진단 결과</h2>

            <div className="space-y-8">
              <div className="grid gap-6 grid-cols-[1.4fr_0.9fr] items-center">

                <h1 className="mt-3 text-4xl font-bold leading-tight text-[#1f1a14] md:text-5xl">
                  {result.kitchenType}
                </h1>

                <p className="mt-4 text-2xl italic text-[#5f574d]">
                  {flavorTitle}
                </p>

                <p className="mt-3 text-base leading-7 text-[#7a746b]">
                  강한 Heat / Umami 축 중심 구조
                </p>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="flex h-[160px] flex-col justify-center rounded-2xl border border-[#ece4d8] bg-white/50 p-6">
                  <div>
                    <p className="text-sm text-[#1f1a14]">
                      보유 양념
                    </p>

                    <p className="text-xs tracking-wide text-[#7a746b]">
                      Ingredient Collection
                    </p>
                  </div>

                  <div className="mt-3 flex flex-1 items-center gap-2">
                    <span className="text-5xl font-bold text-[#1f1a14]">
                      {ingredientCount}
                    </span>

                    <span className="mb-1 text-sm text-[#7a746b]">
                      종
                    </span>
                  </div>
                </div>

                <div className="flex h-[160px] flex-col justify-center rounded-2xl border border-[#ece4d8] bg-white/50 p-6">
                  <p className="text-sm text-[#7a746b]">
                    Flavor Spectrum
                  </p>

                  <div className="mt-3 flex flex-1 items-center gap-2">
                    <span className="text-5xl font-bold text-[#1f1a14]">
                      {flavorSpectrum}
                    </span>

                    <span className="mb-1 text-sm text-[#7a746b]">
                      /10
                    </span>
                  </div>
                </div>
              </div>


              <div className="mt-8 grid gap-8 md:grid-cols-[1.2fr_0.8fr] items-start">

                <FlavorRadar
                  scores={normalizedScores}
                  previousScores={previousResult?.scores}
                />

                <div className="space-y-4">
                  <div className="rounded-2xl bg-white/40 p-6 border border-[#ece4d8] space-y-6">

                    <div>
                      <p className="text-sm font-semibold text-[#c06b2d] mb-3">
                        PRIMARY (핵심 축)
                      </p>

                      <ul className="space-y-2">
                        {result.strongAxes.map((axis) => (
                          <li key={axis} className="flex items-center gap-3">
                            <span className="font-semibold">
                              {axis.split(" ")[0]}
                            </span>

                            <span className="uppercase tracking-wide">
                              {axis.split(" ")[1]?.split("/")[0]}
                            </span>

                            <span className="text-[#7a746b]">
                              / {axis.split("/")[1]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-[#ece4d8] pt-6">
                      <p className="text-sm font-semibold text-[#6f8b55] mb-3">
                        SECONDARY (보조 축)
                      </p>

                      <ul className="space-y-2">
                        {result.supportingAxes.length > 0 ? (
                          result.supportingAxes.map((axis) => (
                            <li key={axis} className="flex items-center gap-3">
                              <span className="font-semibold">
                                {axis.split(" ")[0]}
                              </span>

                              <span className="uppercase tracking-wide">
                                {axis.split(" ")[1]?.split("/")[0]}
                              </span>

                              <span className="text-[#7a746b]">
                                / {axis.split("/")[1]}
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="text-[#5f574d]">
                            뚜렷한 보조 축 없음
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="border-t border-[#ece4d8] pt-6">
                      <p className="text-sm font-semibold text-[#4d73b8] mb-3">
                        EXPANSION (확장 가능 축)
                      </p>

                      <ul className="space-y-2">
                        {result.weakAxes.map((axis) => (
                          <li key={axis} className="flex items-center gap-3">
                            <span className="font-semibold">
                              {axis.split(" ")[0]}
                            </span>

                            <span className="uppercase tracking-wide">
                              {axis.split(" ")[1]?.split("/")[0]}
                            </span>

                            <span className="text-[#7a746b]">
                              / {axis.split("/")[1]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>


                </div>
              </div>

              {previousResult && (
                <div className="rounded-xl border border-[#ded5c8] p-4 mb-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#7a746b]">
                    이전 진단과 비교
                  </p>

                  <div className="mt-3 space-y-1">
                    {flavorDiffs.map((item) => (
                      <p key={item.label}>
                        {item.label}{" "}
                        {item.diff > 0 ? "▲" : "▼"}{" "}
                        {item.diff > 0 ? "+" : "-"}
                        {Math.abs(item.diff)}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl bg-[#f8f4ec] p-5">
                  <p className="mb-3 text-sm text-[#5f574d]">주방 성향 해석</p>
                  <ul className="space-y-2 text-[#1f1a14]">
                    {result.summary?.split("\n").map((line) => (
                      <li key={line} className="flex gap-2 leading-7">
                        <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5f574d]" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl bg-[#f8f4ec] p-5">
                  <p className="mb-3 text-sm text-[#5f574d]">새로운 맛 세계 제안</p>
                  <ul className="space-y-2 text-[#1f1a14]">
                    {result.recommendation.map((item, i) => (
                      <li key={`${item}-${i}`} className="flex gap-2 leading-7">
                        <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5f574d]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}


        {recommendedItems.length > 0 && (
          <section className="mt-8 rounded-3xl border border-[#ded5c8] bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b08a2e]">
              추천 확장 재료
            </p>

            <h3 className="mt-3 text-lg font-semibold text-[#1f1a14]">
              당신 주방의 맛을 확장해보세요
            </h3>

            <p className="mt-2 text-xs leading-5 text-[#7a746b]">
              네이버 쇼핑 기준 낮은 가격순 참고입니다.
              배송비·옵션에 따라 실제 가격은 달라질 수 있습니다.
            </p>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {recommendedItems.slice(0, 6).map((item) => {
                const naverUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(
                  item.naverKeyword
                )}`;

                const coupangUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(
                  item.coupangKeyword
                )}`;

                return (
                  <div
                    key={`${item.axisCode}-${item.itemName}`}
                    className="rounded-2xl border border-[#ded5c8] bg-[#f8f4ec] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1f1a14]">
                          {item.itemName}
                        </p>
                        <p className="mt-1 text-xs text-[#5f574d]">
                          {item.axisCode} {item.axisName} 보완
                        </p>
                      </div>
                      <span className="rounded-full border border-yellow-700/40 bg-yellow-950/10 px-2 py-1 text-xs text-[#b08a2e]">
                        대표 보완
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-neutral-400">
                      {item.note}
                    </p>
                    {shoppingResults[item.itemName]?.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-[#ded5c8] bg-white/70 p-3">
                        <div className="mb-3">

                        </div>

                        <div className="space-y-2">
                          {shoppingResults[item.itemName].slice(0, 3).map((product) => (
                            <a
                              key={product.productId}
                              href={product.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl border border-[#ded5c8] bg-[#f8f4ec] p-3 hover:bg-white"
                            >
                              <p className="line-clamp-2 text-xs leading-5 text-[#1f1a14]">
                                {product.title}
                              </p>

                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-xs text-[#5f574d]">
                                  {product.mallName}
                                </span>

                                <span className="text-sm font-semibold text-[#1f1a14]">
                                  {Number(product.lprice).toLocaleString()}원
                                </span>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <a
                        href={naverUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-neutral-700 px-3 py-2 text-center text-xs font-semibold text-[#1f1a14] hover:bg-[#1f1a14] hover:text-white"
                      >
                        네이버 쇼핑
                      </a>

                      <a
                        href={coupangUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-neutral-700 px-3 py-2 text-center text-xs font-semibold text-[#1f1a14] hover:bg-[#1f1a14] hover:text-white"
                      >
                        쿠팡 검색
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#ded5c8] bg-[#f4efe6]/95 backdrop-blur px-4 py-3">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-3 items-center">

            <button
              type="button"
              onClick={() => {
                const currentResult = result as any;

                const strongAxesText =
                  currentResult?.strongAxes?.length > 0
                    ? currentResult.strongAxes.join(", ")
                    : "없음";

                const supportingAxesText =
                  currentResult?.supportingAxes?.length > 0
                    ? currentResult.supportingAxes.join(", ")
                    : "없음";

                const weakAxesText =
                  currentResult?.weakAxes?.length > 0
                    ? currentResult.weakAxes.join(", ")
                    : "없음";

                const kitchenType =
                  currentResult?.kitchenType ||
                  currentResult?.kitchen_type ||
                  currentResult?.type ||
                  "LOIA 진단형 주방";

                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                  alert("스토리 이미지를 만들 수 없습니다.");
                  return;
                }

                canvas.width = 1080;
                canvas.height = 1920;

                ctx.fillStyle = "#050505";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = "#737373";
                ctx.font = "28px sans-serif";
                ctx.fillText("LOIA KITCHEN DIAGNOSIS", 80, 140);

                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 68px sans-serif";
                ctx.fillText("내 주방은", 80, 300);
                ctx.fillText(kitchenType, 80, 390);
                ctx.fillText("입니다.", 80, 480);

                ctx.strokeStyle = "#404040";
                ctx.lineWidth = 2;
                ctx.strokeRect(80, 600, 920, 680);

                ctx.fillStyle = "#a3a3a3";
                ctx.font = "32px sans-serif";
                ctx.fillText("강한 맛 축", 120, 700);

                ctx.fillStyle = "#ffffff";
                ctx.font = "34px sans-serif";
                ctx.fillText(strongAxesText, 120, 770);

                ctx.fillStyle = "#a3a3a3";
                ctx.font = "32px sans-serif";
                ctx.fillText("보조 맛 축", 120, 900);

                ctx.fillStyle = "#ffffff";
                ctx.font = "34px sans-serif";
                ctx.fillText(supportingAxesText, 120, 970);

                ctx.fillStyle = "#a3a3a3";
                ctx.font = "32px sans-serif";
                ctx.fillText("부족한 맛 축", 120, 1080);

                ctx.fillStyle = "#ffffff";
                ctx.font = "34px sans-serif";
                ctx.fillText(weakAxesText, 120, 1150);

                ctx.fillStyle = "#737373";
                ctx.font = "30px sans-serif";
                ctx.fillText("당신의 양념장은", 80, 1560);
                ctx.fillText("어떤 맛 구조일까?", 80, 1610);

                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 52px sans-serif";
                ctx.fillText("LOIA", 80, 1760);

                ctx.fillStyle = "#737373";
                ctx.font = "26px sans-serif";
                ctx.fillText("Kitchen Diagnosis Beta", 80, 1810);

                const imageUrl = canvas.toDataURL("image/png");

                const link = document.createElement("a");
                link.href = imageUrl;
                link.download = "loia-story-diagnosis.png";
                link.click();
              }}
              className="w-full rounded-full border border-[#1f1a14] px-5 py-4 text-center text-sm font-semibold text-[#1f1a14] hover:bg-[#1f1a14] hover:text-white"
            >
              스토리 이미지 저장
            </button>

            <button type="button"
              onClick={async () => {
                const currentResult = result as any;
                const shareText = [
                  "당신의 양념장은 어떤 맛 구조일까?",
                  "",
                  "LOIA Kitchen Diagnosis",
                ].join("\n");
                const shareData = {
                  title: "LOIA Kitchen Diagnosis",
                  text: shareText,
                  url: "https://loia-kitchen-diagnosis.vercel.app/",
                };

                try {
                  const nav = navigator as Navigator & {
                    share?: (data: ShareData) => Promise<void>;
                  };

                  if (nav.share) {
                    await nav.share(shareData);
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(
                      `${shareText}

                  ${shareData.url}`
                    );
                    alert("공유 문구와 링크가 복사되었습니다.");
                  } else {
                    alert("공유 기능을 사용할 수 없습니다. 주소창의 링크를 직접 복사해주세요.");
                  }
                } catch (error) {
                  console.log("공유가 취소되었거나 실패했습니다.", error);
                }
              }}
              className="w-full rounded-full bg-[#1f1a14] px-5 py-4 text-white font-semibold text-black hover:bg-[#3a3027] transition-colors duration-200">
              친구에게 공유하기
            </button>

            <a
              href="https://www.instagram.com/loia.system/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-full border border-[#1f1a14] px-5 py-4 text-center text-sm font-semibold text-[#1f1a14] hover:bg-[#1f1a14] hover:text-white">
              LOIA Instagram
            </a>

          </div>
        </div>

        <footer className="mt-12 border-t border-neutral-800 pt-6 text-sm text-neutral-600">
          <p className="mt-8 whitespace-pre-line text-xs leading-6 text-neutral-500">
            {`현재 LOIA Kitchen Diagnosis는 베타 테스트 버전입니다.
              사진 인식과 재료 매칭은 완벽하지 않을 수 있으며, 진단 결과는 참고용입니다.
              업로드한 사진 원본은 저장하지 않으며, 양념명 인식과 주방 진단을 위한 분석 목적으로만 사용됩니다.
              다만 서비스 개선을 위해 입력한 양념명, AI 인식 결과, 찾은 재료, 찾지 못한 재료, 진단 결과는 저장될 수 있습니다.`}
          </p>
        </footer>
      </section>
    </main >
  );
}