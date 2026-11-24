import pathlib,sys
d=pathlib.Path(__file__).parent; base=(d/'style.css').read_text()
NAV='<nav><a href="/connect">Connect</a><a href="/how-it-works">How it works</a><a href="/for-builders">For builders</a></nav>'
pages={'connect':('Connect your agent to Teroir','Send work to Teroir from your AI agent and get back an approved, signed reply.'),
 'how':('How Teroir\'s agent door works','How a request moves through Teroir\'s agent door.'),
 'builders':('Teroir\'s agent door, for builders','The standards Teroir\'s agent door uses today.')}
(d/'out').mkdir(exist_ok=True)
for k,(t,desc) in pages.items():
    css=base+(d/f'{k}.css').read_text(); body=(d/f'{k}.body.html').read_text()
    html=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>{t}</title><meta name="description" content="{desc}">
<style>{css}</style></head><body><main>
{body}
{NAV}
</main></body></html>
'''
    assert '<script' not in html and 'src=' not in html and 'url(' not in html and '@import' not in html, k
    (d/'out'/f'{k}.html').write_text(html)
print('built')
