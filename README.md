# Translation Minutes

リアルタイム文字起こし・翻訳・要約で議事録（Markdown）を生成する PWA。Next.js(App Router) をベースに、ローカル保存を前提としたプライバシーファースト設計です。

## 概要
- 録音: マイク/タブ音声を1–5秒チャンク（既定3秒、設定可）で収集
- 文字起こし: Groq whisper-large-v3 優先、失敗/枯渇時は OpenAI Whisper へ自動フォールバック
- 翻訳/要約: Groq/OpenAI の Chat API を利用（ユーザーのAPIキー）
- 話者分離: VAD による簡易 A/B 切替＋手動編集
- 保存/出力: IndexedDB へローカル保存、Markdown ダウンロード、JSON インポート/エクスポート
- PWA: スマホ優先の最小UI（キャッシュ等の強化は今後）

## 技術スタック
- Next.js 14 (App Router), React 18
- TailwindCSS（shadcn 風の軽量UIラッパ）
- framer-motion（必要箇所のみ）
- Prisma（SQLite、既定は無効）

## ディレクトリ
- `app/`: ルーティング、ページ、API ルート
- `components/`: 録音/ライブ字幕/翻訳/要約/編集/保存などのUI
- `lib/`: 音声処理(Recorder/PCM/WAV/VAD/Worklet)、STTクライアントとオーケストレーション、整形、ストレージ、状態、辞書
- `public/`: PWA マニフェスト、アイコン、AudioWorklet（`worklets/vad-processor.js`）
- `docs/`: 要件/決定/MVP/アーキテクチャ
- `prisma/`: `schema.prisma`（`SERVER_PERSISTENCE=1`時のみ利用）

## アーキテクチャ概要
- 音声取得: `MediaRecorder` または PCM→WAV チャンク化（設定で切替）
- VAD: AudioWorklet 版を優先、動的パラメータ更新（閾値/ハングオーバー）。フォールバックに ScriptProcessor 版
- STT: `STTOrchestrator` が Groq→OpenAI の優先順で送信。CORS 回避のため Next.js Route Handler 経由のプロキシも選択可
- 翻訳/要約: `/api/llm/complete` で Chat API を呼び出し。翻訳はクライアント側キューでレート制御（最大2並列、約250ms間隔）
- ストレージ: IndexedDB へセッション保存（`LocalSessionPanel`）、JSON で入出力

## セットアップ
1) 依存インストール
```
npm i
```

2) 環境変数（任意）
- `.env` を作成（`.env.example` 参照）
  - `NEXT_PUBLIC_STT_VIA_PROXY=1` にすると STT を Next.js の API 経由でプロキシ（CORS 回避）
  - サーバ永続化を使う場合のみ `SERVER_PERSISTENCE=1` と `DATABASE_URL`（SQLite）

## 実行
- 開発サーバ: `npm run dev`
- 本番ビルド: `npm run build` → `npm start`
- 静的エクスポート（必要時）: `npm run build:export`

## 使い方（MVP）
1) 画面右上の設定から API プロバイダ（Groq/OpenAI）と API キーを入力
2) 録音タブで「マイク」または「タブ音声」を選択して「議事録開始」
3) 2秒程度で暫定字幕、3秒程度で翻訳が表示（環境に依存）
4) 編集タブで話者A/Bの修正、辞書適用、ローカル保存/読み込み
5) 出力タブで要約/翻訳、Markdown ダウンロード

## 環境変数
`.env.example` より:
```
# サーバ永続化API（自己ホスト時のみ有効化）
SERVER_PERSISTENCE=0
DATABASE_URL="file:./data.db"

# STT を Next.js API 経由でプロキシ（CORS回避）
NEXT_PUBLIC_STT_VIA_PROXY=0
```

## セキュリティ/プライバシー
- クラウド保存は行いません。音声/テキストはローカル保存が既定
- STT/LLM 利用時のみ外部 API へ送信（設定で OFF 可）
- API キーはブラウザ（localStorage/IndexedDB）に保存。サーバへ保存しません
- サーバ永続化APIは既定で無効（`SERVER_PERSISTENCE=0`）

## 既知の制限/今後
- PWA のキャッシュ/オフライン強化は最小限（今後 `next-pwa` 等で調整可）
- 既定チャンクは 3 秒（設定で 1–2 秒へ短縮可能）
- 実運用レイテンシは環境やネットワークに依存（並列数/待ち時間は設定で調整）

## 開発メモ
- 主要ファイル
  - `lib/stt/groq.ts` / `lib/stt/openai.ts` / `lib/stt/index.ts`（フォールバック）
  - `lib/audio/recorder.ts` / `lib/audio/vadWorklet.ts` / `public/worklets/vad-processor.js`
  - `components/RecorderControls.tsx` / `components/LocalSessionPanel.tsx`
  - `app/api/stt/transcribe/route.ts` / `app/api/llm/complete/route.ts`
- ドキュメント: `docs/requirements.md` `docs/decision-log.md` `docs/mvp-plan.md` `docs/architecture.md` `AGENTS.md`

---
詳細な仕様・運用ポリシーは `AGENTS.md` と `docs/` を参照してください。

