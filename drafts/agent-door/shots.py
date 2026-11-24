import sys,glob,threading,http.server,functools,os
from playwright.sync_api import sync_playwright
d=os.path.join(os.path.dirname(os.path.abspath(__file__)),'out')
CSP="default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self): self.send_header('Content-Security-Policy',CSP); super().end_headers()
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=d)); threading.Thread(target=srv.serve_forever,daemon=True).start()
port=srv.server_address[1]; outdir=sys.argv[1]; os.makedirs(outdir,exist_ok=True); bad=0
exe=None
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe)
    for w,h,mob in [(390,844,True),(1280,900,False)]:
        for scheme in ['light','dark']:
            ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if mob else 1,is_mobile=mob,has_touch=mob,color_scheme=scheme)
            for k in ['connect','how','builders']:
                pg=ctx.new_page(); errs=[]
                pg.on('console',lambda m,errs=errs: m.type in('error','warning') and errs.append(m.text))
                pg.on('pageerror',lambda e,errs=errs: errs.append(str(e)))
                pg.goto(f'http://127.0.0.1:{port}/{k}.html'); pg.wait_for_timeout(200)
                ov=pg.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
                pg.screenshot(path=f'{outdir}/{k}-{w}-{scheme}.png',full_page=True)
                print(k,w,scheme,'overflow',ov,'errors',errs); bad+= (ov>0)+len(errs)
            ctx.close()
    b.close()
sys.exit(1 if bad else 0)
