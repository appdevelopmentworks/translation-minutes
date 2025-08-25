"use client";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Switch from "@/components/ui/switch";
import Button from "@/components/ui/button";
import { useSettings } from "@/lib/state/settings";

export default function SettingsSheet() {
  const { settings, setSettings } = useSettings();

  return (
    <Card className="space-y-4">
      <div className="text-sm font-medium">設定</div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span>プロバイダ</span>
          <div className="flex gap-2">
            <Button
              variant={settings.apiProvider === "groq" ? "default" : "outline"}
              onClick={() => setSettings({ ...settings, apiProvider: "groq" })}
            >
              Groq
            </Button>
            <Button
              variant={settings.apiProvider === "openai" ? "default" : "outline"}
              onClick={() => setSettings({ ...settings, apiProvider: "openai" })}
            >
              OpenAI
            </Button>
          </div>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Groq API Key</span>
          <Input
            type="password"
            placeholder="gsk_..."
            value={settings.groqApiKey ?? ""}
            onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>OpenAI API Key</span>
          <Input
            type="password"
            placeholder="sk-..."
            value={settings.openaiApiKey ?? ""}
            onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
          />
        </label>
        <div className="flex items-center justify-between">
          <div className="text-sm">STT送信（ON/OFF）</div>
          <Switch
            checked={settings.sttEnabled}
            onCheckedChange={(v) => setSettings({ ...settings, sttEnabled: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm">
            <span>言語ヒント</span>
            <Input
              placeholder="ja"
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>翻訳先</span>
            <Input
              placeholder="en"
              value={settings.targetLanguage}
              onChange={(e) => setSettings({ ...settings, targetLanguage: e.target.value })}
            />
          </label>
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-medium">エクスポートテンプレ（メタ情報）</div>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="grid gap-1 text-sm">
              <span>会議名</span>
              <Input
                placeholder="会議名"
                value={settings.meetingTitle}
                onChange={(e) => setSettings({ ...settings, meetingTitle: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>日付</span>
              <Input
                type="date"
                value={settings.meetingDate}
                onChange={(e) => setSettings({ ...settings, meetingDate: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-1 sm:col-start-auto">
              <span>参加者（カンマ区切り）</span>
              <Input
                placeholder="山田, 佐藤, 田中"
                value={settings.meetingParticipants}
                onChange={(e) => setSettings({ ...settings, meetingParticipants: e.target.value })}
              />
            </label>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-medium">VAD設定</div>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-sm">
              <span>しきい値(dB)</span>
              <Input
                type="number"
                value={settings.vadThresholdDb}
                onChange={(e) => setSettings({ ...settings, vadThresholdDb: Number(e.target.value) })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>ハングオーバ(ms)</span>
              <Input
                type="number"
                value={settings.vadHangoverMs}
                onChange={(e) => setSettings({ ...settings, vadHangoverMs: Number(e.target.value) })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>ターン切替無音(ms)</span>
              <Input
                type="number"
                value={settings.vadSilenceTurnMs}
                onChange={(e) => setSettings({ ...settings, vadSilenceTurnMs: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-medium">ライブ表示/取り込み</div>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="grid gap-1 text-sm">
              <span>ライブ字幕に時刻を表示</span>
              <Switch
                checked={settings.showLiveTimestamps}
                onCheckedChange={(v) => setSettings({ ...settings, showLiveTimestamps: v })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>長尺分割取り込みを使用</span>
              <Switch
                checked={settings.chunkImportEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, chunkImportEnabled: v })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>分割秒数</span>
              <Input
                type="number"
                value={settings.chunkSeconds}
                onChange={(e) => setSettings({ ...settings, chunkSeconds: Number(e.target.value) })}
                min={5}
                max={120}
              />
            </label>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-medium">翻訳/要約スタイル</div>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="grid gap-1 text-sm">
              <span>翻訳フォーマリティ</span>
              <div className="flex gap-2">
                <Button
                  variant={settings.translationFormality === "formal" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, translationFormality: "formal" })}
                >
                  フォーマル
                </Button>
                <Button
                  variant={settings.translationFormality === "informal" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, translationFormality: "informal" })}
                >
                  カジュアル
                </Button>
              </div>
            </label>
            <label className="grid gap-1 text-sm">
              <span>要約の粒度</span>
              <div className="flex gap-2">
                <Button
                  variant={settings.summaryDetail === "concise" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, summaryDetail: "concise" })}
                >
                  簡潔
                </Button>
                <Button
                  variant={settings.summaryDetail === "standard" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, summaryDetail: "standard" })}
                >
                  標準
                </Button>
                <Button
                  variant={settings.summaryDetail === "detailed" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, summaryDetail: "detailed" })}
                >
                  詳細
                </Button>
              </div>
            </label>
            <label className="grid gap-1 text-sm">
              <span>TL;DRを含める</span>
              <Switch
                checked={settings.summaryIncludeTLDR}
                onCheckedChange={(v) => setSettings({ ...settings, summaryIncludeTLDR: v })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>翻訳前に辞書を適用</span>
              <Switch
                checked={settings.translateUseDictionary}
                onCheckedChange={(v) => setSettings({ ...settings, translateUseDictionary: v })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
            <div className="col-span-2 sm:col-span-5 font-medium">要約に含める項目</div>
            <label className="flex items-center gap-2">
              <Switch checked={settings.summaryIncludeTLDR} onCheckedChange={(v) => setSettings({ ...settings, summaryIncludeTLDR: v })} />
              <span>TL;DR</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={settings.summaryIncludeDecisions} onCheckedChange={(v) => setSettings({ ...settings, summaryIncludeDecisions: v })} />
              <span>決定事項</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={settings.summaryIncludeDiscussion} onCheckedChange={(v) => setSettings({ ...settings, summaryIncludeDiscussion: v })} />
              <span>論点と結論</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={settings.summaryIncludeRisks} onCheckedChange={(v) => setSettings({ ...settings, summaryIncludeRisks: v })} />
              <span>リスク</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={settings.summaryIncludeIssues} onCheckedChange={(v) => setSettings({ ...settings, summaryIncludeIssues: v })} />
              <span>課題</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={settings.summaryIncludeNextActions} onCheckedChange={(v) => setSettings({ ...settings, summaryIncludeNextActions: v })} />
              <span>次アクション（担当/期限）</span>
            </label>
          </div>
        </div>
      </div>
    </Card>
  );
}
