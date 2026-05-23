import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    }
);

type Ingredient = {
    name: string;
    code: string;
    salty: number;
    umami: number;
    acid: number;
    sweet: number;
    bitter: number;
    heat: number;
    herb: number;
    spice: number;
    lipid: number;
    texture: number;
};

const ingredientsPath = path.join(process.cwd(), "data/ingredient_function_base.json");
const ingredientsText = fs.readFileSync(ingredientsPath, "utf-8");
const testIngredients: Ingredient[] = JSON.parse(ingredientsText);

// ingredient_db metadata 불러오기
const ingredientDbPath = path.join(
    process.cwd(),
    "data/ingredient_db.json"
);
const ingredientDbText = fs.readFileSync(
    ingredientDbPath,
    "utf-8"
);
const ingredientMetadata = JSON.parse(ingredientDbText);


const aliasMapPath = path.join(process.cwd(), "data/alias_map.json");
const aliasMapText = fs.readFileSync(aliasMapPath, "utf-8");
const aliasMap = JSON.parse(aliasMapText);

const aliasLookup: any = {};

(aliasMap as any[]).forEach((item: any) => {
    aliasLookup[item.alias] = item.standard;
});
const axisLabels = {
    salty: "000 Salty / 염도",
    umami: "100 Umami / 감칠맛",
    acid: "200 Acid / 산미",
    sweet: "300 Sweet / 단맛",
    bitter: "400 Bitter / 쓴맛",
    heat: "500 Heat / 매운맛",
    herb: "600 Herb / 허브",
    spice: "700 Spice / 향신료",
    lipid: "800 Lipid / 지방감",
    texture: "900 Texture / 질감",
};

type AxisKey = keyof typeof axisLabels;

export async function POST(request: Request) {
    const formData = await request.formData();
    const inputText = String(formData.get("ingredients") || "");
    const imageFile = formData.get("image") as File | null;

    const imageInfo = imageFile
        ? `사진 파일 수신됨: ${imageFile.name}, ${Math.round(imageFile.size / 1024)}KB`
        : "사진 파일 없음";

    let detectedIngredientText = "";

    if (imageFile) {
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        const base64Image = imageBuffer.toString("base64");

        const visionResponse = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: "이 이미지는 사용자의 양념장 또는 양념 선반 사진입니다. 사진에서 읽을 수 있거나 추정 가능한 양념명만 한국어로 쉼표로 구분해서 출력하세요. 설명은 하지 마세요. 예: 간장, 고춧가루, 참기름",
                        },
                        {
                            type: "input_image",
                            image_url: `data:${imageFile.type};base64,${base64Image}`,
                        },
                    ],
                },
            ],
        } as any);

        detectedIngredientText = visionResponse.output_text || "";
        console.log("AI가 사진에서 추출한 양념명:", detectedIngredientText);
    }

    const combinedIngredientText = [inputText, detectedIngredientText]
        .filter(Boolean)
        .join(",");

    const selectedNames = combinedIngredientText
        .split(/[\n,\s]+/)
        .map((name: string) => name.trim())
        .filter(Boolean)
        .map((name: string) => {
            const normalized = name.replace(/\s/g, "");
            return aliasLookup[normalized] || name;
        });

    const total: Record<AxisKey, number> = {
        salty: 0,
        umami: 0,
        acid: 0,
        sweet: 0,
        bitter: 0,
        heat: 0,
        herb: 0,
        spice: 0,
        lipid: 0,
        texture: 0,
    };

    // 각 축에 실제로 기여한 재료 개수 기록
    const axisIngredientCounts: Record<AxisKey, number> = {
        salty: 0,
        umami: 0,
        acid: 0,
        sweet: 0,
        bitter: 0,
        heat: 0,
        herb: 0,
        spice: 0,
        lipid: 0,
        texture: 0,
    };

    const normalizedSelectedNames = selectedNames.map((name: string) =>
        name.replace(/\s/g, "")
    );

    const selectedIngredients = testIngredients.filter((ingredient) => {
        const ingredientName = ingredient.name.replace(/\s/g, "");
        const ingredientCode = ingredient.code.replace(/\s/g, "");

        return normalizedSelectedNames.some((name) =>
            ingredientName === name ||
            ingredientCode === name
        );
    });

    const foundNames = selectedIngredients.map((ingredient) => ingredient.name);

    // 선택된 재료들의 metadata 연결
    const selectedIngredientMetadata = ingredientMetadata.filter(
        (item: any) => {
            const metadataName = item.Name_KR?.replace(/\s/g, "");
            return selectedIngredients.some((ingredient) =>
                ingredient.name.replace(/\s/g, "") === metadataName
            );
        }
    );

    // 선택된 재료 metadata 확인
    console.log(
        "selectedIngredientMetadata:",
        selectedIngredientMetadata
    );


    const missingNames = selectedNames.filter(
        (name: string) => !foundNames.includes(name)
    );

    for (const ingredient of selectedIngredients) {
        total.salty += ingredient.salty;
        total.umami += ingredient.umami;
        total.acid += ingredient.acid;
        total.sweet += ingredient.sweet;
        total.bitter += ingredient.bitter;
        total.heat += ingredient.heat;
        total.herb += ingredient.herb;
        total.spice += ingredient.spice;
        total.lipid += ingredient.lipid;
        total.texture += ingredient.texture;
        if (ingredient.salty > 0) axisIngredientCounts.salty++;
        if (ingredient.umami > 0) axisIngredientCounts.umami++;
        if (ingredient.acid > 0) axisIngredientCounts.acid++;
        if (ingredient.sweet > 0) axisIngredientCounts.sweet++;
        if (ingredient.bitter > 0) axisIngredientCounts.bitter++;
        if (ingredient.heat > 0) axisIngredientCounts.heat++;
        if (ingredient.herb > 0) axisIngredientCounts.herb++;
        if (ingredient.spice > 0) axisIngredientCounts.spice++;
        if (ingredient.lipid > 0) axisIngredientCounts.lipid++;
        if (ingredient.texture > 0) axisIngredientCounts.texture++;
    }
    const ingredientCount =

        selectedIngredients.length || 1;

    Object.keys(total).forEach((key) => {

        total[key as AxisKey] =

            Math.round(

                total[key as AxisKey] / ingredientCount

            );

    });

    const sortedAxes = Object.entries(total).sort((a, b) => b[1] - a[1]) as [
        AxisKey,
        number
    ][];
    const nonZeroAxes = sortedAxes.filter(([, score]) => score > 0);

    // 전체 축 평균값 계산
    // 현재 주방의 전체 맛 분포 기준선으로 사용
    const averageScore =
        Object.values(total).reduce((a, b) => Number(a) + Number(b), 0) /
        Object.values(total).length;

    // 축별 구조 점수 계산
    // 단순 강도가 아니라,
    // 실제로 얼마나 구조적으로 형성된 축인지 계산

    const primaryScores: Record<AxisKey, number> = {} as Record<AxisKey, number>;

    Object.keys(total).forEach((key) => {
        const axis = key as AxisKey;

        const axisScore = total[axis];
        const ingredientCount = axisIngredientCounts[axis];

        primaryScores[axis] =
            axisScore * 0.6 +
            ingredientCount * 20;
    });

    // 구조 점수(primaryScores)가 높은 축들을
    // 현재 주방의 중심 맛 구조(PRIMARY)로 판단
    const strongAxes = Object.entries(primaryScores)
        .sort((a, b) => b[1] - a[1])
        .filter(([axis]) =>
            axisIngredientCounts[axis as AxisKey] >= 1
        )
        .slice(0, 2)
        .map(([axis]) => axisLabels[axis as AxisKey]);

    // PRIMARY까지는 아니지만,
    // 일부 재료 연결이 형성된 축들을
    // 보조 맛 구조(SECONDARY)로 판단
    const supportingAxes = Object.entries(primaryScores)
        .sort((a, b) => b[1] - a[1])
        .filter(([axis]) =>
            axisIngredientCounts[axis as AxisKey] >= 2
        )
        .filter(([axis]) =>
            !strongAxes.includes(axisLabels[axis as AxisKey])
        )
        .slice(0, 3)
        .map(([axis]) => axisLabels[axis as AxisKey]);


    // 구조 점수가 낮고,
    // 실제 재료 연결도 거의 없는 축들을
    // 상대적으로 비어있는 확장 구조(EXPANSION)로 판단
    const weakAxes = Object.entries(primaryScores)
        .sort((a, b) => a[1] - b[1])
        .filter(([axis]) =>
            !strongAxes.includes(axisLabels[axis as AxisKey]) &&
            !supportingAxes.includes(axisLabels[axis as AxisKey])
        )
        .slice(0, 3)
        .map(([axis]) => axisLabels[axis as AxisKey]);

    // LOIA Flavor 해석용 중간 데이터
    // 이후 AI Flavor Profile 생성에 사용됨
    const flavorSummary = {
        // 현재 주방의 핵심 축
        dominantAxes: strongAxes,

        // 보조 풍미 축
        supportingAxes,

        // 부족하거나 비어있는 축
        weakAxes,

        // 풍미 스타일 태그
        // 예: "발효 기반", "강한 자극", "깊은 풍미"
        styleTags: [] as string[],

        // 잘 어울리는 요리 방향
        // 예: "찌개", "볶음", "양념장"
        compatibleCuisine: [] as string[],
    };

    // metadata 기반 flavor tag 추출
    selectedIngredientMetadata.forEach((item: any) => {
        const subcategory =
            item.Subcategory?.toLowerCase() || "";
        const description =
            item["Description(사전식 설명)"]?.toLowerCase() || "";

        // 발효 계열 감지
        if (
            subcategory.includes("fermented") ||
            description.includes("발효")
        ) {
            // 해산물 기반 감칠 구조 감지
            if (
                subcategory.includes("seafood") ||
                description.includes("해산물") ||
                description.includes("액젓")
            ) {
                if (
                    !flavorSummary.styleTags.includes("해산물 감칠")
                ) {
                    flavorSummary.styleTags.push("해산물 감칠");
                }
            }
            if (
                !flavorSummary.styleTags.includes("발효 기반")
            ) {
                flavorSummary.styleTags.push("발효 기반");
            }
        }
    });

    // Heat + Umami 구조 해석
    if (
        (
            strongAxes.some((axis) => axis.includes("매운맛")) ||
            supportingAxes.some((axis) => axis.includes("매운맛"))
        ) &&
        strongAxes.some((axis) => axis.includes("감칠맛"))
    ) {
        flavorSummary.styleTags.push(
            "강한 자극",
            "깊은 풍미",
            "발효 기반"
        );

        flavorSummary.compatibleCuisine.push(
            "볶음",
            "찌개",
            "양념장"
        );
    }

    const recommendationMap: Record<string, string> = {
        "salty": "염도 축이 약합니다. 소금, 간장, 액젓처럼 염도를 직접 보완하는 재료를 고려해보세요.",
        "umami": "감칠맛 축이 약합니다. 간장, 된장, 다시다, 버섯, 다시마 계열을 보완하면 맛의 바닥이 안정됩니다.",
        "acid": "산미 축이 약합니다. 식초, 레몬즙, 라임, 발사믹식초 같은 산미 재료를 추가하면 음식이 더 가볍고 선명해집니다.",
        "sweet": "단맛 축이 약합니다. 설탕, 꿀, 올리고당처럼 맛을 둥글게 잡아주는 재료를 보완해보세요.",
        "bitter": "쓴맛 축이 약합니다. 쓴맛은 반드시 많이 필요하진 않지만, 커피·카카오·구운 향 계열이 있으면 맛의 깊이가 생깁니다.",
        "heat": "매운맛/자극 축이 약합니다. 고춧가루, 후추, 생강, 겨자 계열을 보완하면 맛의 긴장감이 생깁니다.",
        "herb": "허브 축이 약합니다. 파슬리, 바질, 딜, 고수 같은 허브류를 추가하면 향이 더 입체적입니다.",
        "spice": "향신료 축이 약합니다. 큐민, 파프리카, 계피, 카레가루 같은 향신료를 보완하면 맛의 개성이 강해집니다.",
        "lipid": "지방감 축이 약합니다. 참기름, 들기름, 올리브유, 버터 같은 지방 재료를 보완하면 풍미 전달력이 좋아집니다.",
        "texture": "질감 축이 약합니다. 깨, 빵가루, 튀김가루, 전분처럼 식감을 만드는 재료를 추가하면 음식의 완성감이 올라갑니다.",
    };



    const recommendation = weakAxes.map((axisKey) => {
        const normalizedKey = axisKey.toLowerCase();

        if (normalizedKey.includes("acid")) {
            return recommendationMap["acid"];
        }

        if (normalizedKey.includes("sweet")) {
            return recommendationMap["sweet"];
        }

        if (normalizedKey.includes("bitter")) {
            return recommendationMap["bitter"];
        }

        if (normalizedKey.includes("heat")) {
            return recommendationMap["heat"];
        }

        if (normalizedKey.includes("herb")) {
            return recommendationMap["herb"];
        }

        if (normalizedKey.includes("spice")) {
            return recommendationMap["spice"];
        }

        if (normalizedKey.includes("lipid")) {
            return recommendationMap["lipid"];
        }

        if (normalizedKey.includes("texture")) {
            return recommendationMap["texture"];
        }

        return null;
    });
    console.log("recommendation:", recommendation);

    // Flavor Narrative 생성
    const flavorPrompt = `
너는 LOIA의 맛 구조 해석가다.
너의 역할은 사용자의 양념 목록을 바탕으로
단순한 맛 점수가 아니라 "이 사람의 주방이 어떤 맛 습관을 가지고 있는지" 해석하는 것이다.

사용자는 이 진단을 통해 다음을 알고 싶어 한다.

1. 왜 내 요리가 자주 비슷한 방향으로 가는지
2. 내 주방은 어떤 맛 성향을 가진 주방인지
3. 현재 양념 구성의 강점과 부족한 축은 무엇인지
4. 무엇을 하나 추가하면 맛이 어떻게 달라지는지
5. 캡처해서 공유하고 싶은 한 줄 요약

[언어 규칙]
- 최종 출력 문장은 반드시 자연스러운 한국어로만 작성한다.
- "flavor", "axis", "dominant", "supporting", "weak", "profile", "expansion", "cuisine", "style tag" 같은 영어 용어를 본문에 쓰지 않는다.
- 영어 데이터명이 입력으로 들어와도, 사용자가 읽는 문장에서는 한국어로 풀어 쓴다.
- "flavor 구조"라고 쓰지 말고 "맛 구조"라고 쓴다.
- "dominant axes"라고 쓰지 말고 "중심 맛"이라고 쓴다.
- "supporting axes"라고 쓰지 말고 "받쳐주는 맛"이라고 쓴다.
- "weak axes"라고 쓰지 말고 "약한 맛 축" 또는 "부족한 맛"이라고 쓴다.
- "compatible cuisine"이라고 쓰지 말고 "잘 맞는 요리 방향"이라고 쓴다.
- 단, JSON key인 "subtitle", "profile", "expansion"은 코드 처리를 위해 그대로 유지한다.

[작성 원칙]
- 분석 리포트처럼 담백하게 작성한다.
- 너무 감성적이거나 오글거리는 표현은 금지한다.
- MBTI처럼 과장된 성격 해석은 금지한다.
- 음식 설명만 하지 말고, 사용자의 요리 습관과 취향을 은근히 추론한다.
- 단정하지 말고 "~경향이 있습니다", "~가능성이 있습니다"를 사용한다.
- 문장은 짧고 단단하게 쓴다.
- 한 문장에는 하나의 관찰만 담는다.
- 전체적으로 브랜드 카피처럼 리듬감은 있되, 과장하지 않는다.
- 사용자가 "아 그래서 내 요리가 비슷했구나"라고 느끼게 해야 한다.

[해석 기준]
- 중심 맛은 이 주방에서 가장 자주 앞으로 나오는 맛이다.
- 받쳐주는 맛은 중심 맛을 보조해 맛의 방향을 고정하는 맛이다.
- 부족한 맛은 현재 요리가 반복되거나 무겁게 느껴질 수 있는 원인이다.
- 스타일 태그는 이 주방의 성향 이름을 만드는 데 활용한다.
- 잘 맞는 요리 방향은 실제 요리 습관을 추론하는 데 활용한다.
- 사용 재료는 구체적인 근거로 사용하되, 재료명을 과하게 나열하지 않는다.

[출력 필드]

subtitle:
- 한 줄 요약
- 사용자가 캡처하고 싶을 만한 문장
- "당신의 주방은 ~한 주방입니다" 형식 권장
- 20~35자 내외
- 너무 시적이지 않게

profile:
- 4~6문장
- 첫 문장: 현재 맛 구조를 해석한다.
- 두 번째 문장: 이 구조가 어떤 요리 스타일과 잘 맞는지 말한다.
- 세 번째 문장: 왜 요리가 비슷하게 반복될 수 있는지 설명한다.
- 네 번째 문장 이후: 사용자의 요리 습관이나 취향을 조심스럽게 추론한다.
- 강한 맛과 부족한 맛을 모두 언급한다.
- "이런 요리를 자주 해왔을 가능성이 있습니다" 같은 생활 추론 허용.
- 단, 사용자를 평가하거나 단정하지 않는다.

expansion:
- 3~5문장
- 현재 구조를 반복 설명하지 않는다.
- 부족한 맛을 보완하면 어떤 변화가 생기는지 말한다.
- 바로 추가해볼 수 있는 재료나 방향을 제안한다.
- "다음 장보기 때 ~ 중 하나만 추가해도" 같은 실천 문장 허용.
- 결과는 사용자가 바로 행동할 수 있어야 한다.

[미인식 재료 처리]
- 미인식 재료가 많으면 결과의 확신도를 낮춰 표현한다.
- "일부 재료가 아직 반영되지 않아 결과는 현재 인식된 재료 기준입니다"라는 뉘앙스를 expansion 마지막에 자연스럽게 포함한다.
- 단, 사용자에게 오류처럼 보이게 하지 말고 베타 개선 과정처럼 말한다.

[금지]
- "완벽한", "운명", "소울", "천재", "타고난" 같은 과장 표현 금지
- "당신은 이런 사람입니다"처럼 성격을 단정하는 표현 금지
- 재료 목록을 그대로 길게 반복 금지
- 약한 축을 결핍처럼 비난하는 표현 금지
- 의학적, 심리학적 진단처럼 쓰지 말 것
- JSON value 안에 영어 표현을 쓰지 말 것

[현재 맛 구조]
중심 맛:
${flavorSummary.dominantAxes.join(", ")}

받쳐주는 맛:
${flavorSummary.supportingAxes.join(", ")}

부족한 맛:
${flavorSummary.weakAxes.join(", ")}

스타일 태그:
${flavorSummary.styleTags.join(", ")}

잘 맞는 요리 방향:
${flavorSummary.compatibleCuisine.join(", ")}

사용 재료:
${foundNames.join(", ")}

미인식 재료:
${missingNames?.join(", ") || "없음"}

반드시 아래 JSON 형태로만 응답해라.
JSON key는 영어로 유지하되, value 안의 문장은 반드시 한국어로만 작성해라.
JSON 외의 설명, 마크다운, 코드블록은 절대 쓰지 마라.

{
  "subtitle": "...",
  "profile": "...",
  "expansion": "..."
}
`;
    const narrativeResponse = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: flavorPrompt,
    });

    const parsed = JSON.parse(
        narrativeResponse.output_text || "{}"
    );

    const flavorSubtitle =
        parsed.subtitle || "";

    const flavorNarrative =
        parsed.profile || "";

    const flavorExpansionNarrative =
        parsed.expansion || "";

    const mainAxis = strongAxes[0] || "";

    const kitchenType = mainAxis.includes("Salty")
        ? "염도 중심형 주방"
        : mainAxis.includes("Umami")
            ? "감칠맛 중심형 주방"
            : mainAxis.includes("Acid")
                ? "산미 중심형 주방"
                : mainAxis.includes("Sweet")
                    ? "단맛 중심형 주방"
                    : mainAxis.includes("Bitter")
                        ? "쓴맛 중심형 주방"
                        : mainAxis.includes("Heat")
                            ? "매운맛 중심형 주방"
                            : mainAxis.includes("Herb")
                                ? "허브 중심형 주방"
                                : mainAxis.includes("Spice")
                                    ? "향신료 중심형 주방"
                                    : mainAxis.includes("Lipid")
                                        ? "지방감 중심형 주방"
                                        : mainAxis.includes("Texture")
                                            ? "질감 중심형 주방"
                                            : "LOIA 진단형 주방";
    const result = {
        kitchenType,
        strongAxes,
        supportingAxes,
        weakAxes,
        scores: total,
        recommendation,
        flavorSummary,
        flavorNarrative,
        flavorExpansionNarrative,
        flavorSubtitle,

        summary:
            selectedIngredients.length > 0
                ? `찾은 재료: ${foundNames.join(", ")}
찾지 못한 재료: ${missingNames.length > 0 ? missingNames.join(", ") : "없음"}
사진 파일: ${imageInfo}
분석 방식: 찾은 재료의 맛 축 점수를 합산한 뒤 강한 축, 보조 축, 부족한 축을 계산했습니다.`
                : `찾은 재료: 없음
찾지 못한 재료: ${missingNames.length > 0 ? missingNames.join(", ") : "없음"}
사진 파일: ${imageInfo}
분석 방식: 입력된 재료 중 DB에서 찾을 수 있는 재료가 없습니다.`,
    };

    const isTest =
        request.headers.get("host")?.includes("localhost");

    const { error: insertError } = await supabase
        .from("loia_diagnosis_logs")
        .insert({
            user_input: inputText,
            ai_detected: detectedIngredientText,
            found_ingredients: foundNames,
            missing_ingredients: missingNames,
            strong_axes: strongAxes,
            supporting_axes: supportingAxes,
            weak_axes: weakAxes,
            summary: result.summary,
            is_test: isTest,
        });

    if (insertError) {
        console.error("Supabase 저장 실패:", insertError);
    }
    console.log("RESULT CHECK:", result);
    return NextResponse.json(result);


} 