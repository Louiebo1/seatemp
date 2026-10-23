# Regenerates the boat list in js/party.js from the iPhone app's PartyBoats.swift.
import json, re, sys
app = sys.argv[1] if len(sys.argv) > 1 else '../sst/SeaTemp/PartyBoats.swift'
boats = re.findall(r'PartyBoat\(name: "([^"]+)", landing: "([^"]+)", city: "([^"]+)"\)', open(app).read())
js = open('js/party.js').read()
rows = ",\n".join(f"  [{json.dumps(n)}, {json.dumps(l)}, {json.dumps(c)}]" for n, l, c in boats)
js = re.sub(r'export const PARTY_BOATS = \[\n.*?\n\]', 'export const PARTY_BOATS = [\n' + rows + ',\n]', js, flags=re.S)
open('js/party.js', 'w').write(js)
print(len(boats), 'boats')
