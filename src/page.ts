// The homepage: paste a post URL, get the post or X Article rendered, copy or download it as Markdown.
// Plain HTML + a tiny Markdown renderer, no external scripts.

export function homePage(origin: string, coffeeUrl: string, repoUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>X Reader</title>
<meta name="description" content="Paste an X post link and read the post or full X Article as clean Markdown. Free, no login.">
<meta property="og:title" content="X Reader">
<meta property="og:description" content="Read any public X post or full X Article as clean Markdown. Copy it into Claude or ChatGPT.">
<style>
:root{--bg:#f6f6f4;--card:#fff;--text:#1d1d1b;--muted:#6b6b66;--line:#e4e4df;--accent:#1d9bf0;--accent-text:#fff;--code:#f0f0ec;--err:#b42318;--err-bg:#fef3f2}
@media (prefers-color-scheme:dark){:root{--bg:#0f1012;--card:#17181b;--text:#ececea;--muted:#9a9a95;--line:#2a2b2f;--accent:#1d9bf0;--accent-text:#fff;--code:#202125;--err:#fda29b;--err-bg:#2a1615}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 16px 64px}
header h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em}
header p{margin:0 0 24px;color:var(--muted)}
form{display:flex;gap:8px}
input{flex:1;min-width:0;padding:12px 14px;font:inherit;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:10px;outline:none}
input:focus{border-color:var(--accent)}
button{font:inherit;font-weight:600;padding:12px 18px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text);cursor:pointer;white-space:nowrap}
button.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
button:disabled{opacity:.6;cursor:default}
.hint{font-size:13px;color:var(--muted);margin:8px 2px 0}
.error{margin-top:16px;padding:12px 14px;border-radius:10px;background:var(--err-bg);color:var(--err)}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:24px 0 12px}
.tabs{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.tabs button{border:0;border-radius:0;padding:8px 14px;font-weight:500}
.tabs button[aria-selected=true]{background:var(--text);color:var(--bg)}
.toolbar .spacer{flex:1}
.toolbar .small{padding:8px 14px;font-weight:500}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px}
#md{width:100%;min-height:60vh;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;resize:vertical}
.article{overflow-wrap:anywhere}
.article h1{font-size:26px;line-height:1.25;margin:0 0 12px}
.article h2{font-size:21px;margin:28px 0 8px}
.article h3,.article h4{font-size:18px;margin:22px 0 6px}
.article p{margin:0 0 14px}
.article img,.article video{max-width:100%;border-radius:10px;display:block;margin:6px 0 16px;background:var(--code)}
.article a{color:var(--accent);word-break:break-word}
.article blockquote{margin:0 0 14px;padding:4px 16px;border-left:3px solid var(--accent);color:var(--muted)}
.article pre{white-space:pre-wrap;background:var(--code);padding:14px;border-radius:10px;overflow:auto;font-size:13px;margin:0 0 14px}
.article code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em}
.article p code{background:var(--code);padding:1px 5px;border-radius:5px}
.article hr{border:0;border-top:1px solid var(--line);margin:24px 0}
.article ul,.article ol{margin:0 0 14px;padding-left:24px}
.article .meta{font-size:14px;color:var(--muted)}
footer{margin-top:40px;font-size:14px;color:var(--muted)}
footer code{background:var(--code);padding:2px 6px;border-radius:6px;word-break:break-all}
footer a{color:var(--accent)}
[hidden]{display:none!important}
@media (max-width:520px){form{flex-direction:column}main{padding-top:24px}.card{padding:16px}}
</style>
</head>
<body>
<main>
<header>
<h1>X Reader</h1>
<p>Paste an X post link. Get the post or the full X Article as clean Markdown.</p>
</header>

<form id="f">
<input id="url" type="url" inputmode="url" autocomplete="off" required placeholder="https://x.com/user/status/123..." aria-label="X post URL">
<button class="primary" id="go" type="submit">Read</button>
</form>
<p class="hint">Works with x.com and twitter.com links, including posts that share an X Article.</p>

<div id="err" class="error" hidden></div>

<section id="out" hidden>
<div class="toolbar">
<div class="tabs" role="tablist">
<button type="button" role="tab" id="tPrev" aria-selected="true">Preview</button>
<button type="button" role="tab" id="tMd" aria-selected="false">Markdown</button>
</div>
<span class="spacer"></span>
<button type="button" class="small" id="copy">Copy Markdown</button>
<button type="button" class="small" id="dl">Download .md</button>
</div>
<div id="prev" class="card article"></div>
<textarea id="md" readonly hidden aria-label="Markdown"></textarea>
</section>

<footer>
<p><strong>Use it inside Claude or ChatGPT:</strong> add <code>${origin}/mcp</code> as a custom connector, then paste any post link in chat.</p>
<p>Free and <a href="${repoUrl}" target="_blank" rel="noopener">open source</a>. Powered by the FxTwitter API. Not affiliated with X Corp.</p>
<p>If this saved you time, <a href="${coffeeUrl}" target="_blank" rel="noopener">buy me a coffee ☕</a></p>
</footer>
</main>

<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var current = "", currentName = "x-post";

  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function inline(raw){
    var s = esc(raw);
    s = s.replace(/!\\[([^\\]]*)\\]\\((https?:\\/\\/[^)\\s]+)\\)/g, function(m,a,u){ return '<img alt="'+a+'" src="'+u+'" loading="lazy">'; });
    s = s.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)\\s]+)\\)/g, function(m,t,u){ return '<a href="'+u+'" target="_blank" rel="noopener">'+t+'</a>'; });
    s = s.replace(/\`([^\`]+)\`/g, "<code>$1</code>");
    s = s.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\\w])\\*(?!\\s)([^*]+?)\\*(?!\\*)/g, "$1<em>$2</em>");
    s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
    return s;
  }

  var VIDEO = /^\\[(Video[^\\]]*|GIF)\\]\\((https?:\\/\\/[^)\\s]+)\\)(?: \\(thumbnail: (https?:\\/\\/\\S+)\\))?$/;

  function render(md){
    var lines = md.split("\\n"), html = [], i = 0, para = [];
    function flush(){ if(para.length){ html.push("<p>"+para.map(inline).join("<br>")+"</p>"); para = []; } }
    while(i < lines.length){
      var line = lines[i], t = line.trim(), m;
      if(t.indexOf("\`\`\`") === 0){
        flush(); var code = []; i++;
        while(i < lines.length && lines[i].trim().indexOf("\`\`\`") !== 0){ code.push(lines[i]); i++; }
        html.push("<pre><code>"+esc(code.join("\\n"))+"</code></pre>"); i++; continue;
      }
      if(t === ""){ flush(); i++; continue; }
      if(t === "---"){ flush(); html.push("<hr>"); i++; continue; }
      if((m = t.match(/^(#{1,4}) (.*)$/))){ flush(); var lv = m[1].length; html.push("<h"+lv+">"+inline(m[2])+"</h"+lv+">"); i++; continue; }
      if((m = t.match(VIDEO))){
        flush();
        if(m[1] === "GIF") html.push('<video src="'+esc(m[2])+'" autoplay loop muted playsinline></video>');
        else html.push('<video controls preload="none" playsinline src="'+esc(m[2])+'"'+(m[3] ? ' poster="'+esc(m[3])+'"' : "")+"></video>");
        i++; continue;
      }
      if(t.indexOf(">") === 0){
        flush(); var q = [];
        while(i < lines.length && lines[i].trim().indexOf(">") === 0){ q.push(lines[i].trim().replace(/^>\\s?/, "")); i++; }
        html.push("<blockquote>"+q.filter(function(x){return x.trim();}).map(function(x){return "<p>"+inline(x)+"</p>";}).join("")+"</blockquote>"); continue;
      }
      if(/^[-*] /.test(t) || /^\\d+\\. /.test(t)){
        flush(); var ordered = /^\\d+\\. /.test(t), items = [];
        while(i < lines.length){
          var lt = lines[i].trim();
          if(ordered ? !/^\\d+\\. /.test(lt) : !/^[-*] /.test(lt)) break;
          items.push("<li>"+inline(lt.replace(/^([-*]|\\d+\\.) /, ""))+"</li>"); i++;
        }
        html.push((ordered ? "<ol>" : "<ul>")+items.join("")+(ordered ? "</ol>" : "</ul>")); continue;
      }
      para.push(t); i++;
    }
    flush();
    return html.join("\\n");
  }

  function show(tab){
    var p = tab === "prev";
    $("tPrev").setAttribute("aria-selected", p); $("tMd").setAttribute("aria-selected", !p);
    $("prev").hidden = !p; $("md").hidden = p;
  }
  $("tPrev").onclick = function(){ show("prev"); };
  $("tMd").onclick = function(){ show("md"); };

  function fail(msg){ $("err").textContent = msg; $("err").hidden = false; $("out").hidden = true; }

  async function read(u){
    $("err").hidden = true; $("go").disabled = true; $("go").textContent = "Reading...";
    try{
      var res = await fetch("/read?url=" + encodeURIComponent(u));
      var text = await res.text();
      if(!res.ok) return fail(text);
      current = text;
      var idm = u.match(/status(?:es)?\\/(\\d+)/); currentName = idm ? "x-post-" + idm[1] : "x-post";
      $("md").value = text;
      $("prev").innerHTML = render(text).replace("<p><strong>Author:</strong>", '<p class="meta"><strong>Author:</strong>');
      $("out").hidden = false; show("prev");
      history.replaceState(null, "", "?url=" + encodeURIComponent(u));
    }catch(e){ fail("Network error. Check your connection and try again."); }
    finally{ $("go").disabled = false; $("go").textContent = "Read"; }
  }

  $("f").onsubmit = function(e){ e.preventDefault(); var u = $("url").value.trim(); if(u) read(u); };

  $("copy").onclick = async function(){
    try{ await navigator.clipboard.writeText(current); }
    catch(e){ $("md").hidden = false; $("md").select(); document.execCommand("copy"); }
    var b = $("copy"); b.textContent = "Copied"; setTimeout(function(){ b.textContent = "Copy Markdown"; }, 1500);
  };

  $("dl").onclick = function(){
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([current], { type: "text/markdown" }));
    a.download = currentName + ".md"; a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  };

  var start = new URLSearchParams(location.search).get("url");
  if(start){ $("url").value = start; read(start); } else { $("url").focus(); }
})();
</script>
</body>
</html>`;
}
