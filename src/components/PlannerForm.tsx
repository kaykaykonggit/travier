import type { ReactNode } from "react";
import type { TripBrief } from "../lib/planner";

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "plan-field wide" : "plan-field"}>
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

export function PlannerForm({
  brief,
  onChange,
}: {
  brief: TripBrief;
  onChange: (brief: TripBrief) => void;
}) {
  function set<K extends keyof TripBrief>(key: K, value: TripBrief[K]) {
    onChange({ ...brief, [key]: value });
  }

  return (
    <div className="plan-table">
      <Field wide label="想去的地方" hint="城市或地區，建議按順路順序，以逗號分隔">
        <input
          value={brief.destinations}
          onChange={(event) => set("destinations", event.target.value)}
          placeholder="維也納、薩爾斯堡、羅馬、米蘭"
        />
      </Field>
      <Field label="出發日">
        <input type="date" value={brief.startDate} onChange={(event) => set("startDate", event.target.value)} />
      </Field>
      <Field label="回程日">
        <input type="date" value={brief.endDate} onChange={(event) => set("endDate", event.target.value)} />
      </Field>
      <Field label="常住／出發城市">
        <input value={brief.origin} onChange={(event) => set("origin", event.target.value)} placeholder="香港" />
      </Field>
      <Field label="出發點" hint="機場或車站，可留空">
        <input
          value={brief.departurePoint}
          onChange={(event) => set("departurePoint", event.target.value)}
          placeholder="香港國際機場 HKG"
        />
      </Field>
      <Field label="回程點" hint="留空則視為與出發點相同">
        <input
          value={brief.returnPoint}
          onChange={(event) => set("returnPoint", event.target.value)}
          placeholder="米蘭馬爾彭薩 MXP"
        />
      </Field>
      <Field label="大人">
        <input inputMode="numeric" value={brief.adults} onChange={(event) => set("adults", event.target.value)} />
      </Field>
      <Field label="小孩">
        <input inputMode="numeric" value={brief.children} onChange={(event) => set("children", event.target.value)} />
      </Field>
      <Field label="每日平均景點">
        <select value={brief.sightsPerDay} onChange={(event) => set("sightsPerDay", event.target.value)}>
          <option value="2">約 2 個，偏慢</option>
          <option value="3">約 3 個</option>
          <option value="4">約 4 個</option>
          <option value="5">約 5 個，偏趕</option>
          <option value="any">不限</option>
        </select>
      </Field>
      <Field label="交通為主">
        <select value={brief.transport} onChange={(event) => set("transport", event.target.value)}>
          <option value="transit">公共交通</option>
          <option value="drive">自駕</option>
          <option value="mix">混合</option>
        </select>
      </Field>
      <Field label="節奏">
        <select value={brief.pace} onChange={(event) => set("pace", event.target.value)}>
          <option value="relaxed">休閒</option>
          <option value="normal">一般</option>
          <option value="packed">緊湊</option>
        </select>
      </Field>
      <Field label="夜火車">
        <select value={brief.nightTrain} onChange={(event) => set("nightTrain", event.target.value)}>
          <option value="ok">可以</option>
          <option value="prefer">希望坐一晚</option>
          <option value="no">不要</option>
        </select>
      </Field>
      <Field label="酒店一房一晚">
        <input
          inputMode="decimal"
          value={brief.hotelBudget}
          onChange={(event) => set("hotelBudget", event.target.value)}
          placeholder="180"
        />
      </Field>
      <Field label="預算貨幣">
        <select value={brief.hotelCurrency} onChange={(event) => set("hotelCurrency", event.target.value)}>
          <option value="EUR">EUR</option>
          <option value="HKD">HKD</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
      </Field>
      <Field label="酒店類型">
        <select value={brief.hotelStyle} onChange={(event) => set("hotelStyle", event.target.value)}>
          <option value="any">不限</option>
          <option value="budget">經濟</option>
          <option value="mid">中價舒適</option>
          <option value="boutique">精品設計</option>
        </select>
      </Field>
      <Field label="餐飲人均／日" hint="可留空，由 AI 估算">
        <input
          inputMode="decimal"
          value={brief.mealBudget}
          onChange={(event) => set("mealBudget", event.target.value)}
          placeholder="40"
        />
      </Field>
      <Field label="最早出門" hint="可留空">
        <input type="time" value={brief.earliestStart} onChange={(event) => set("earliestStart", event.target.value)} />
      </Field>
      <Field wide label="必去／必看">
        <input
          value={brief.mustSee}
          onChange={(event) => set("mustSee", event.target.value)}
          placeholder="宮廷音樂會、美泉宮、最後的晚餐"
        />
      </Field>
      <Field wide label="不要／想避開">
        <input
          value={brief.avoid}
          onChange={(event) => set("avoid", event.target.value)}
          placeholder="不要遊輪、不要太早出發"
        />
      </Field>
      <Field wide label="興趣">
        <input
          value={brief.interests}
          onChange={(event) => set("interests", event.target.value)}
          placeholder="藝術、市集、美食、自然"
        />
      </Field>
      <Field wide label="其他備註">
        <textarea
          value={brief.notes}
          onChange={(event) => set("notes", event.target.value)}
          placeholder="聖誕市集、其中一天要休息、已有某段火車票…"
          rows={3}
        />
      </Field>
    </div>
  );
}
