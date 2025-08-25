# AGENTS ガイドライン（v0.1）

このドキュメントは、本プロジェクトのバイブコーディング/引き継ぎを円滑に行うための合意済みルールと実装方針のまとめです。次回以降の作業は本ガイドラインに準拠してください。

## プロダクト概要
- 目的: マイク/タブ音声をリアルタイム文字起こしし、議事録（Markdown）を生成。録音後の要約・アクション抽出、翻訳/同時通訳にも対応。
- 対象: 個人利用、クライアント共有。データはローカル保存。
- プラットフォーム: Next.js（App Router）+ PWA（スマートフォン優先）。

## 技術スタック
- Next.js (App Router)
- TailwindCSS
- shadcn/ui（今回はTailwindベースの軽量ラッパで代替）
- framer-motion

## MVPスコープ（要点）
- 録音: マイク/タブ音声（PC）、マイクのみ（モバイル）。1–2秒チャンク。
- 文字起こし: Groqの whisper-large-v3 を優先、枯渇/失敗時は OpenAI Whisper へフォールバック。
- 遅延: 暫定字幕は2秒以内、翻訳字幕は3秒以内。
- 後処理: フィラ除去、基本の句読点整形。
- 話者分離: 簡易A/Bクラスタリング＋手動修正（精度向上は次フェーズ）。
- 要約/抽出/翻訳: APIベースで実装（ユーザーのAPIキー使用）。
- 出力: Markdownダウンロード。IndexedDB/LocalStorageを用いたローカル保存。
 - ローカルセッション: IndexedDBにセッション保存/読み込み（JSONインポート/エクスポート対応）。UIはエディタ下の`LocalSessionPanel`。
- 翻訳: 逐次翻訳はクライアント側キューでレート制御（最大2件先行、約250ms間隔）。
- 翻訳/要約スタイル: 設定で翻訳フォーマリティ（フォーマル/カジュアル）、要約粒度（簡潔/標準/詳細）、TL;DR有無を指定し、ライブ翻訳と最終要約のトーンを統一。
 - 要約項目: 決定事項/論点/リスク/課題/次アクションをチェックボックスで制御し、プロンプトに反映。
 - 辞書適用: 「翻訳前に辞書を適用」オプションで用語統一（md/pdf/txtからマッピング作成→適用）。

## 確定済みの主要決定（Decision Log要約）
1. プライバシー: STT送信はユーザーの明示許容でON/OFF可能。完全ローカルSTTはMVP外。
2. オンライン音取り込み: PCは「タブ音声＋マイク」のみ、モバイルはマイクのみ。
3. レイテンシ目標: 暫定字幕≤2秒、翻訳字幕≤3秒。
4. 話者分離: MVPは簡易A/B＋手動修正。高精度化は後続。
5. APIキー: まずGroq（whisper-large-v3）を試行、無料枠切れ時はOpenAIに切替。
6. 同時編集: MVPでは非対応（単独編集）。
7. SLO: 未設定。MVP後に実測して設定。

## セキュリティ/プライバシー
- クラウド保存は行わない。音声/テキストの永続化はローカルのみ。
- STT/LLM利用時のみ外部APIへ送信（設定でOFF可）。
- APIキーは端末に保存（localStorage/IndexedDB）。キーのログ出力や送信禁止。
 - サーバ保存（Prisma/SQLite）は既定OFF。自己管理サーバで利用する場合のみ `SERVER_PERSISTENCE=1` を設定。既定ではAPIは404を返す。

## 入出力/制約
- 入力: マイク（PC/モバイル）、タブ音声（PCのみ）。OS全体のシステム音は対象外。
- ファイル取り込み: mp3/wav/m4a（録音後の一括変換に対応）。
- 出力: Markdownのみ。端末にダウンロード。

## 実装ポリシー
- 音声処理: `MediaRecorder`で1–2秒チャンク。ノイズ抑制はWebRTC AudioProcessing（将来RNNoise-WASM検討）。
- STT: OpenAI互換 `/audio/transcriptions` 形で実装。Groqは `response_format=verbose_json` を指定してセグメント取得。必要に応じて `lib/stt/groq.ts` を更新。
- オーケストレーション: `STTOrchestrator`でGroq→OpenAIの順にフォールバック。
- テキスト整形: `lib/processing/text.ts`（フィラ除去/句読点）。
- ストレージ: `lib/storage/indexeddb.ts` と設定 `lib/state/settings.tsx`。
- UI方針: モバイル優先、最小UI（shadcn風）。アクセシビリティ（文字サイズ/配色/ショートカット）を段階的に追加。
 - エクスポート: 設定の会議名/日付/参加者をMarkdownヘッダに差し込み、要約付き出力にも反映。
 - ライブ字幕: 設定でタイムスタンプ表示ON/OFF。セグメントは`startMs`を持ち、Audioプレイヤーがあればジャンプ可能。
 - 取り込み: WebAudioで長尺を分割（WAVチャンク化）し、逐次STT→進捗表示（%）。
 - CORS対応: 直接呼び出しが不可の場合、Next.jsのRoute Handlerでプロキシ（キーは保存せず、リクエストで受け取り転送）。

## ディレクトリ/主要ファイル
- `app/` … App Router、`layout.tsx`/`page.tsx`。
- `components/` … UIラッパと機能パーツ（RecorderControls/LiveTranscript/Settings/要約）。
- `lib/audio/recorder.ts` … 音声チャンク化。
- `lib/stt/` … `groq.ts`/`openai.ts`/`index.ts`（フォールバック）/`types.ts`。
- `lib/processing/text.ts` … フィラ/句読点処理。
- `lib/state/settings.tsx` … 設定コンテキスト。
- `lib/storage/indexeddb.ts` … IndexedDBラッパ。
- `docs/` … 仕様/決定/MVP/アーキテクチャ（更新必須）。
- `lib/audio/vadWorklet.ts` / `public/worklets/vad-processor.js` … AudioWorklet版VAD（優先使用）。
 - VADパラメータ更新: 設定変更をWorkletに動的送信。フォールバックVADもsetParams対応。
- `prisma/schema.prisma` … Prismaスキーマ（SQLite）。`.env` の `DATABASE_URL` を使用。
- `app/api/sessions/*` … セッション/セグメント保存API（`SERVER_PERSISTENCE=1` の時のみ有効）。

## 開発コマンド
- 依存インストール: `npm i`
- 開発サーバ: `npm run dev`
- ビルド: `npm run build` → `npm start`

## 受入チェック（MVP）抜粋
- 録音開始で2秒以内に暫定字幕が表示される。
- 翻訳字幕が3秒以内に表示される。
- 既存音声ファイルの全文文字起こしが可能。
- 要約に「決定事項/論点/次アクション/期限/担当」を含む。
- 話者A/Bの編集が可能。フィラ除去が有効。
- 生成結果をMarkdownでダウンロードできる。
- データ/APIキーはローカルのみで保持。送信ON/OFFを切替可能。

## 次の優先タスク（推奨）
- 要約/翻訳APIの接続（Groq/OpenAI）とUI反映。
- 簡易話者分離（VAD+クラスタ）と編集UI。
- 用語辞書（.md/.pdf→pdf.js）取り込みと事後補正適用。
- アクセシビリティ設定（文字サイズ/テーマ）とPWA微調整。

## バイブコーディング運用
- 作業前に plan を更新（`update_plan`）し、各ステップを小さく明確に。
- 連続するコマンドは1–2文のプレアンブルで意図を共有。
- 仕様/決定は `/docs` に都度追記（requirements/decision-log/mvp-plan/architecture）。
- 破壊的変更や外部通信が必要な場合は事前に合意を取る。

以上に従って作業を進めてください。変更があれば本ファイルと `/docs` を更新します。
