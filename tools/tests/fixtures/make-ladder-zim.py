#!/usr/bin/env python3
"""make-ladder-zim.py: writes a small Kiwix library for testing the question ladder.

Usage: python3 make-ladder-zim.py OUT.zim [--layout new|nolisting]
  new        the current layout (libzim's default): articles in "C", a title listing of articles
  nolisting  the same articles without the title listing, so the reader falls back to the path index

The articles are short and written for these tests (CC BY-SA 4.0, like the toolkit's text). They
copy the shape of Kiwix's Wikipedia pages: a bold term in the first sentence, links between
articles, sections, a "See also" list and references that the ladder must skip, Kiwix's own
"this article is from..." box, redirects, an image, a list page, a page that points elsewhere
("may refer to"), a one-sentence stub, and a topic that can hurt. Nothing here is random except the
identifiers libzim gives every file, so the questions built from it are the same every time.
"""
import sys

try:
    from libzim.writer import Creator, Hint, Item, StringProvider
except ImportError:
    sys.exit("make-ladder-zim.py needs python-libzim: pip install libzim==4.1.0")

out = sys.argv[1] if len(sys.argv) > 1 else "ladder-test.zim"
layout = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == "--layout" else "new"

FOOTER = ('<!--htdig_noindex--><div class="issued">This article is issued from the Ladder test library. '
          'The text is licensed under <a class="external text" href="https://creativecommons.org/licenses/by-sa/4.0/">'
          'Creative Commons - Attribution - Sharealike</a>.</div><!--/htdig_noindex-->')


def page(title, body):
    return ('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title>'
            '<link href="style.css" rel="stylesheet"><script src="script.js"></script></head><body>'
            '<div id="content"><h1>' + title + '</h1><div id="mw-content-text">' + body + '</div>' + FOOTER +
            '</div></body></html>')


ARTICLES = {
    "Photosynthesis": page("Photosynthesis", """
<p><b>Photosynthesis</b> is the process by which plants, algae and some bacteria turn the energy of light into chemical energy stored in sugars.<sup class="reference">[1]</sup> It takes in <a href="Carbon_dioxide">carbon dioxide</a> and <a href="Water">water</a>, and it gives off <a href="Oxygen">oxygen</a>.</p>
<table class="infobox"><tr><td>Takes place in: chloroplasts</td></tr></table>
<p>Most photosynthesis happens in the <a href="Leaf">leaves</a> of plants, inside small parts of each cell called <a href="Chloroplast">chloroplasts</a>. The green pigment <a href="Chlorophyll">chlorophyll</a> absorbs red and blue light, which is why leaves look green to us. Without photosynthesis, there would be almost no oxygen in the air, and most food chains would have nothing to start from.</p>
<h2>Process</h2>
<p>Light energy splits water molecules, which releases oxygen as a by-product. The energy captured from light is then used to join carbon dioxide into sugars, because the plant needs them to grow and to store energy. Chlorophyll in the chloroplasts makes the first step possible.</p>
<p>The rate of photosynthesis depends on light, temperature and the amount of carbon dioxide in the air. On a hot, dry day, many plants close the pores in their leaves, which reduces water loss but also slows photosynthesis.</p>
<h2>History</h2>
<p>In 1779 the Dutch scientist <a href="Jan_Ingenhousz">Jan Ingenhousz</a> showed that plants need light to give off oxygen. Later scientists argued about where the oxygen came from, and the debate was settled when experiments showed it comes from water, not from carbon dioxide.</p>
<h2>Importance</h2>
<p>Scientists estimate that land plants and ocean algae together capture more than 100 billion tonnes of carbon each year. However, cutting down forests reduces how much carbon dioxide plants can take in, unlike planting trees, which can increase it over time.</p>
<p>Farmers, gardeners and foresters all depend on photosynthesis, and some researchers think that understanding it better could help grow more food with less water.</p>
<h2>See also</h2>
<ul><li><a href="Chlorophyll">Chlorophyll</a></li><li><a href="Water_cycle">Water cycle</a></li></ul>
<h2>References</h2>
<ol class="references"><li>A textbook of plant biology, chapter 4, which says the process is about light and sugars in plants.</li></ol>
"""),
    "Water cycle": page("Water cycle", """
<p>The <b>water cycle</b> is the continuous movement of water between the oceans, the air and the land. The <a href="Sun">Sun</a> heats water in oceans, lakes and rivers, which causes it to <a href="Evaporation">evaporate</a> into the air as water vapour.</p>
<p>About 97 percent of Earth's water is salt water in the oceans. As water vapour rises and cools, it forms <a href="Cloud">clouds</a>, and when the droplets grow heavy enough they fall as <a href="Precipitation">precipitation</a>: rain, snow or hail.</p>
<h2>On the land</h2>
<p>Some rain soaks into the <a href="Soil">soil</a> and becomes groundwater, while some runs off into streams and <a href="River">rivers</a>. Plants also return water to the air through their leaves, which links the water cycle to photosynthesis.</p>
<p>Scientists think that a warmer climate may speed up parts of the water cycle, which could lead to heavier rain in some places and longer droughts in others.</p>
"""),
    "Pollination": page("Pollination", """
<p><b>Pollination</b> is the movement of pollen from one flower to another, which allows plants to make seeds. Many plants rely on animals such as <a href="Honey_bee">bees</a>, butterflies, birds and bats to carry pollen, while others rely on the <a href="Wind">wind</a>.</p>
<p>Many food crops depend at least in part on animal pollinators. Some researchers argue that the loss of wild flowers and the use of certain pesticides are reducing the number of pollinators, although other scientists say more long-term studies are needed.</p>
<h2>Gardens</h2>
<p>Gardens with many kinds of flowers, which bloom at different times of year, give pollinators food from spring to autumn. A <a href="Rain_garden">rain garden</a> can also provide flowers and shelter.</p>
"""),
    "Honey bee": page("Honey bee", """
<p>The <b>honey bee</b> is a social insect that lives in colonies and makes honey from the nectar of flowers. A strong colony can contain tens of thousands of worker bees, one queen and a few hundred drones in summer.</p>
<p>Honey bees are important pollinators of fruit trees and many other crops. Worker bees communicate the direction of food with a movement called the waggle dance, which was first described by <a href="Karl_von_Frisch">Karl von Frisch</a> in the 1940s.</p>
"""),
    "Soil": page("Soil", """
<p><b>Soil</b> is the loose upper layer of the ground, made of minerals, <a href="Organic_matter">organic matter</a>, water, air and countless living things. Healthy soil holds water like a sponge and stores nutrients that plants need.</p>
<p>Soil forms very slowly, as rock breaks down and dead plants and animals decay, so a few centimetres can take hundreds of years to build. Erosion by wind and water can remove it much faster, which is why farmers plant cover crops and hedges to protect it.</p>
<p>Earthworms, fungi and bacteria break down dead material into <a href="Compost">compost</a> and humus, which improves the soil's structure.</p>
"""),
    "Compost": page("Compost", """
<p><b>Compost</b> is decayed organic material, such as food scraps and leaves, that is used to feed <a href="Soil">soil</a>. Composting returns nutrients to the ground and reduces the amount of waste sent to landfill.</p>
<p>A compost heap needs a mix of green material, which is rich in nitrogen, and brown material, which is rich in carbon. Air and moisture allow the bacteria and fungi that do the work to thrive, so many gardeners turn their heap every few weeks.</p>
"""),
    "Wetland": page("Wetland", """
<p>A <b>wetland</b> is an area of land that is covered by water, or soaked with it, for all or part of the year. Marshes, swamps and bogs are all kinds of wetland.</p>
<p>Wetlands filter water, store floodwater and provide homes for many birds, fish and plants. When wetlands are drained for farms or buildings, nearby towns can face more flooding, because the land can no longer hold the extra water.</p>
"""),
    "Coral reef": page("Coral reef", """
<p>A <b>coral reef</b> is an underwater structure built by colonies of tiny animals called corals. Reefs grow in warm, shallow, clear water, and they shelter about a quarter of all ocean species even though they cover a very small part of the sea floor.</p>
<p>Corals get much of their food from algae that live inside them. When the water gets too warm, the corals push the algae out and turn white, which is called coral bleaching. Bleached corals can recover if temperatures fall, but repeated bleaching may kill them.</p>
"""),
    "River": page("River", """
<p>A <b>river</b> is a large, natural stream of fresh water that flows towards an ocean, a lake or another river. Rivers carry water from rain and melting snow across the land as part of the <a href="Water_cycle">water cycle</a>.</p>
<p>People have built towns beside rivers for thousands of years, because rivers provide water, food, transport and fertile land. Dams can supply electricity and store water, but they also change how fish travel and how sediment moves downstream.</p>
"""),
    "Rain garden": page("Rain garden", """
<p>A <b>rain garden</b> is a shallow garden bed that collects rainwater from roofs, driveways and streets and lets it soak slowly into the ground. Rain gardens reduce flooding and keep pollution out of streams.</p>
<p>They are planted with native plants that can survive both wet and dry periods, which also helps <a href="Pollination">pollinators</a>.</p>
"""),
    "Printing press": page("Printing press", """
<p>A <b>printing press</b> is a machine that presses inked type onto paper to print many copies of a text. <a href="Johannes_Gutenberg">Johannes Gutenberg</a> developed a printing press with movable metal type in Europe around 1440.</p>
<p>The printing press made books much cheaper, which helped ideas spread quickly and led to more people learning to read. Historians debate how much it caused later changes in science and religion, and how much it simply sped up changes that were already happening.</p>
<p>Earlier, printers in China and Korea had used carved wooden blocks and movable type, although their writing systems needed many more characters.</p>
"""),
    "Bridge": page("Bridge", """
<p>A <b>bridge</b> is a structure that carries a road, a path or a railway across an obstacle such as a river or a valley. Engineers choose a design, such as a beam, an arch or a suspension bridge, depending on the distance to cross and the ground on each side.</p>
<p>A bridge must carry its own weight as well as the weight of everything that crosses it. Wind, earthquakes and the expansion of materials in hot weather also affect how a bridge is built, so engineers test their designs with models and computers.</p>
"""),
    "Fraction": page("Fraction", """
<p>A <b>fraction</b> represents a part of a whole or, more generally, any number of equal parts. A fraction such as three quarters is written with a numerator on top and a denominator below a line.</p>
<p>The denominator tells how many equal parts the whole is divided into, and the numerator tells how many of those parts are taken. Fractions with different denominators can be compared by finding a common denominator, unlike whole numbers, which can be compared directly.</p>
"""),
    "Volcano": page("Volcano", """
<p>A <b>volcano</b> is an opening in a planet's surface through which molten rock, ash and gases escape from below. On Earth, most volcanoes form where tectonic plates pull apart or push together.</p>
<p>Eruptions can destroy nearby towns, but volcanic ash also makes some of the most fertile soil in the world, which is why many people farm near volcanoes. Scientists watch for small earthquakes and changes in gases, which may warn that an eruption is coming.</p>
"""),
    "Wind power": page("Wind power", """
<p><b>Wind power</b> is the use of wind turbines to turn the energy of moving air into electricity. A wind turbine's blades spin a shaft connected to a generator.</p>
<p>Wind power produces no smoke while it runs, although building turbines uses materials and energy. Because the wind does not always blow, wind farms are often combined with other sources of electricity and with ways of storing energy.</p>
"""),
    "Landmine": page("Landmine", """
<p>A <b>landmine</b> is an explosive weapon hidden in or on the ground that is set off by a person or a vehicle. Landmines can remain dangerous for decades after a war has ended.</p>
<p>The Ottawa Treaty of 1997 bans anti-personnel landmines, and most countries have joined it. Trained demining teams find and remove mines so that families can farm, walk and play safely again.</p>
"""),
    "List of rivers": page("List of rivers", """
<p>This is a list of rivers, arranged by continent, with their length and the sea they flow into.</p>
<ul><li><a href="River">River</a></li><li><a href="Water_cycle">Water cycle</a></li></ul>
"""),
    "Mercury": page("Mercury", """
<p><b>Mercury</b> may refer to: the planet closest to the Sun; the chemical element with the symbol Hg; or a messenger god in Roman religion.</p>
"""),
    "Seed": page("Seed", """
<p>A <b>seed</b> is a small part of a plant that can grow into a new plant.</p>
"""),
}
REDIRECTS = {"Photosynthetic": "Photosynthesis", "Hydrologic cycle": "Water cycle", "Bees": "Honey bee"}
# A 1x1 green PNG: an image, which the ladder must never offer as a topic
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                    "1f15c4890000000d49444154789c63606860f80f00010401004b6b5d6e0000000049454e44ae426082")


class Entry(Item):
    def __init__(self, path, title, mimetype, content, front):
        super().__init__()
        self._p, self._t, self._m, self._c, self._f = path, title, mimetype, content, front

    def get_path(self): return self._p
    def get_title(self): return self._t
    def get_mimetype(self): return self._m
    def get_contentprovider(self): return StringProvider(self._c)
    def get_hints(self): return {Hint.FRONT_ARTICLE: self._f}


def path_of(title):
    return title.replace(" ", "_")


creator = Creator(out).config_indexing(True, "eng").config_nbworkers(1)
if layout == "nolisting":
    # libzim always writes the listing; leave it out by not marking anything as a front article
    pass
with creator as c:
    c.set_mainpath("index")
    for k, v in {"Name": "test_en_ladder", "Title": "Ladder test library", "Description": "A small library for testing the question ladder",
                 "Language": "eng", "Creator": "AI Co-Evolution in Education tests", "Publisher": "AI Co-Evolution in Education tests",
                 "Date": "2026-11-17", "License": "CC BY-SA 4.0", "Tags": "_ftindex:yes;_pictures:no;_videos:no"}.items():
        c.add_metadata(k, v)
    front = layout != "nolisting"
    for title, html in sorted(ARTICLES.items()):
        c.add_item(Entry(path_of(title), title, "text/html", html.encode("utf-8"), front))
    links = "".join('<li><a href="%s">%s</a></li>' % (path_of(t), t) for t in sorted(ARTICLES))
    c.add_item(Entry("index", "Ladder test library", "text/html", page("Ladder test library", "<p>Welcome to the Ladder test library, a small set of articles for testing.</p><ul>" + links + "</ul>").encode("utf-8"), False))
    c.add_item(Entry("_assets_/leaf.png", "leaf.png", "image/png", PNG, False))
    c.add_item(Entry("style.css", "style.css", "text/css", b"body{font-family:sans-serif}", False))
    c.add_item(Entry("script.js", "script.js", "application/javascript", b"/* nothing */", False))
    for source, target in sorted(REDIRECTS.items()):
        c.add_redirection(path_of(source), source, path_of(target), {Hint.FRONT_ARTICLE: False})
print(out)
