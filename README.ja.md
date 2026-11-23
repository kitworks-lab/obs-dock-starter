# obs-dock-starter

[English README (README.md)](./README.md)

OBS Studio の「カスタムブラウザドック」と「透過ブラウザソース」を `localStorage` だけで同期させる、ゼロ依存の HTML / CSS / JS スターターテンプレートです。

Node.js サーバーも obs-websocket プラグインも不要。ビルド手順も外部 CDN 読み込みもありません。4つのファイルをローカルの同じフォルダに置いて OBS へ登録すれば、その場で動きます。

## 入っているファイル

- `dock.html`（OBS の端に常駐させる手元操作パネル。ステータス切替プリセット、タイトル・サブタイトル編集、カウンター操作、オーバーレイ表示ON/OFF、同期状態表示）
- `overlay.html`（1920×1080 の透過ブラウザソース。ドック側の操作をそのまま配信画面へ反映）
- `shared.js`（スキーマバージョン管理 `SCHEMA_VERSION = 1`、安全な `JSON.parse`、`storage` イベント＋`BroadcastChannel`＋350msポーリング保険をまとめた同期ヘルパー）
- `style.css`（先頭の CSS 変数 `:root` を書き換えるだけで色・角丸・フォントをまとめて変えられるスタイル定義）

## OBS Studio への導入（3ステップ）

1. GitHub の「Code」→「Download ZIP」で落とし、任意のローカルフォルダ（例：`C:\OBS-Widgets\obs-dock-starter\`）に解凍する
2. OBS のブラウザソースに `overlay.html` を追加する
   - ソース「＋」→「ブラウザ」
   - 「ローカルファイル」にチェックを入れて `overlay.html` を選択
   - 幅 `1920`、高さ `1080` に設定
3. カスタムブラウザドックに `dock.html` を追加する
   - 上部メニュー「ドック」→「カスタムブラウザドック」を開く
   - ドック名（例：`Stream Dock`）を入力
   - `dock.html` を Chrome か Edge にドラッグ＆ドロップし、アドレス欄の `file:///...` を丸ごとコピーして URL 欄へ貼り付け、「適用」を押す

最初は独立ウィンドウで開くので、タイトルバーをつかんで OBS の左右の端へ寄せると既存パネルにドッキングできます。

> つまずきやすい点：エクスプローラーの `C:\...\dock.html` を直接貼ると開けないことがあります。ブラウザ経由の `file:///...` を使うと、スペースや日本語フォルダ名も自動でエンコードされるので確実です。

## 同期の仕組み

```text
+-------------------+        localStorage.setItem(KEY)        +----------------------+
|     dock.html     |  ------------------------------------>  |     overlay.html     |
| カスタムブラウザ   |        + BroadcastChannel (即時反映)    | 1920x1080 透過       |
| ドック（手元操作） |        + 350ms seq:updatedAt ポーリング  | ブラウザソース        |
+-------------------+                                         +----------------------+
         \                                                              /
          +------------------------ shared.js -------------------------+
                  スキーマ検証 (v1) + 安全な JSON.parse + 重複スキップ
```

通常の Chrome タブ間なら `BroadcastChannel` や `storage` イベントだけで即時同期できます。ただ、OBS のビルドや OS の組み合わせによっては `file:///` で開いたドックとブラウザソース間でイベントが飛ばないことがありました。

そのため `shared.js` では書き込みのたびに連番 `seq` と `updatedAt` を付け、350ms おきのポーリング保険を入れています。前回と同じスタンプなら DOM 更新をスキップするので負荷はほとんど増えません。

## カスタマイズの目安

### 30秒で見た目を変える

`style.css` の先頭にある CSS 変数を書き換えるだけで、ドックとオーバーレイ両方の配色が切り替わります。

```css
:root {
  --dock-accent: #2f8f5b;
  --ov-bg: rgba(24, 25, 29, 0.92);
  --ov-ink: #f4f5f7;
  --ov-radius: 10px;
}
```

### URL クエリで位置やテーマを切り替える

`overlay.html` をローカルファイル指定ではなく URL（`file:///.../overlay.html?pos=top-right&theme=paper`）で読み込むと、ファイルを複製せずに配置やテーマを変えられます。

| クエリ | 指定できる値 | 初期値 |
| --- | --- | --- |
| `pos` | `bottom-left`, `bottom-right`, `top-left`, `top-right` | `bottom-left` |
| `theme` | `dark`, `paper` | `dark` |
| `scale` | `0.5` 〜 `2.5` | `1` |

### 項目を増やすとき

1. `shared.js` の `createDefaultState()` に初期値を足す
2. `sanitizeState()` で型チェックと文字数制限を入れる
3. 既存データと互換性が切れる変更をしたら `SCHEMA_VERSION` を上げる
4. `dock.html` から `ObsDockStarter.saveState({ ... })` を呼び、`overlay.html` で描画する

## すぐ使える完成版ウィジェット・デモ・関連リンク

この仕組みをベースにしたポモドーロタイマー・時計・待機画面・目標ゲージ・耐久カウンター・お題ルーレットを KitWorks Lab で公開しています。ブラウザ上でそのまま触れる無料デモもあります。

- 無料ライブデモ・Webツール: [kitworks-lab.github.io](https://kitworks-lab.github.io/)
- BOOTH ショップ（TokiDock / GoalDock 無料Lite版・Pro版）: [kitworks.booth.pm](https://kitworks.booth.pm/)
- Zenn（設計記事・ゼロ依存Node.js実践ガイド）: [zenn.dev/kitworks](https://zenn.dev/kitworks) ／ [実践ガイド本](https://zenn.dev/kitworks/books/388f2b2ed4c788)
- note（OBSドック設計・配信運用メモ）: [note.com/kitworks_lab](https://note.com/kitworks_lab)
- YouTube（KitWorks Lab チャンネル）: [KitWorks Lab](https://www.youtube.com/channel/UC_r4xzn2zs3gjbU3rXn3lpA)

## ライセンス

MIT License（詳細は [LICENSE](./LICENSE) を参照）
