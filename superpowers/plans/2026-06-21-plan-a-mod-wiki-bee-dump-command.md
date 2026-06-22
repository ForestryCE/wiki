# Plan A — Mod `dump wiki_bees` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use @superpowers:test-driven-development for every task that has tests.

**Goal:** Add a `/forestry dump wiki_bees` command to ForestryCE that dumps all bee species, hives, and mutations from the **live game registry** to `config/forestry/wiki/bees.json`, so wiki editors can capture data including addon-mod species (Mo' Bees, etc.).

**Architecture:** Separate the game-independent logic (pretty-printable DTOs + Gson serialization, princess-chance math, color formatting) from the game-dependent extraction (reading registries). Unit-test the pure parts with the existing MC-free JUnit layer; validate the full live-registry extraction with a Forge GameTest. The command is a new subcommand under the existing `DumpCommand`.

**Tech Stack:** Java 17, Forge 1.20.1, Gson (ships with MC), JUnit 5 (Jupiter, already configured), Forge GameTest framework.

**Source repo:** `/home/thedarkcolour/IdeaProjects/ForestryCE/ForestryCE-1.20.1` (all paths below are relative to it).

**Authoritative data contract:** `superpowers/specs/2026-06-21-forestry-bee-wiki-pipeline-design.md` §4.1 (in the wiki repo). The JSON this command emits MUST conform to it.

---

## Context the executor needs

- **Test harness already exists on `feature/multiblock-redesign`** (this is the base to build on — see Task 0):
  - MC-free JUnit 5: `testImplementation 'org.junit.jupiter:junit-jupiter:6.0.3'`, `testRuntimeOnly 'org.junit.platform:junit-platform-launcher'`, `test { useJUnitPlatform() }`. Tests live in `src/test/java/...` and import **no** `net.minecraft` types. Run: `./gradlew test`.
  - GameTest: classes in `src/main/java/forestry/gametest/`, annotated `@GameTestHolder(ForestryConstants.MOD_ID)` + `@PrefixGameTestTemplate(false)`, methods annotated `@GameTest(...)` taking a `GameTestHelper`. A `gameTestServer` run config is in `build.gradle` (`systemProperty 'forge.enabledGameTestNamespaces', 'forestry'`). Run: `./gradlew runGameTestServer`. Example: `src/main/java/forestry/gametest/MultiblockGameTests.java`.
- **The WIP `src/main/java/forestry/core/commands/AllDataDump.java`** is staged-but-uncommitted and **unreferenced** (not wired into any command). It contains: a broken `begin()` (lazy `.map()`, never collected/written), a half-built genome `JsonObject` builder, and a working-but-unwired `computePrincessChances(List<IHiveDrop>, int)`. This plan **harvests** its princess math (Task 1) and the extraction sketch (Task 4), then **deletes** the file (Task 6).
- **The existing `bee_species` literal in `DumpCommand` is a real, shipping command** (iterates species, logs stats to the logger). Do **NOT** modify or overload it. We add a new sibling `wiki_bees` literal.
- **Key APIs** (verified against the codebase):
  - Species: `forestry.core.utils.SpeciesUtil.getAllBeeSpecies()` → `List<IBeeSpecies>`.
  - Genome: `species.getDefaultGenome()`; `species.getKaryotype().getChromosomes()` (filter `getSpeciesChromosome()`); per chromosome `genome.getActiveAllele(chromosome)`, `chromosome.getDisplayName(allele.cast())`, `allele.alleleId()`, `allele.dominant()`. `IAllele` is sealed: `IBooleanAllele`/`IIntegerAllele`/`IFloatAllele`/`IValueAllele<V>` (each has `value()`).
  - Products/specialties: `species.getProducts()`/`getSpecialties()` → `IProduct` (`item()`, `chance()`); item id via `net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(item)`.
  - Colors: `species.getBody()/getStripes()/getOutline()` → packed `int` RGB.
  - Climate: `species.getTemperature()` (`TemperatureType`), `species.getHumidity()` (`HumidityType`).
  - Metadata: `getBinomial()`, `getSpeciesName()`, `getGenus()` (`ITaxon`: `name()`, `rank()`, `parent()`), `getAuthority()`, `getComplexity()`, `isSecret()`, `isDominant()`, `hasGlint()`.
  - Hives: `forestry.api.IForestryApi.INSTANCE.getHiveManager().getHives()` → `IHive` (`getDefinition()`, `getDrops()`, `genChance()`); `IHiveDrop` (`createIndividual(BlockGetter, BlockPos)` → `IBee`; `getChance(BlockGetter, BlockPos, int)`; `getIgnobleChance(BlockGetter, BlockPos, int)`). Use `net.minecraft.world.level.EmptyBlockGetter.INSTANCE` + `net.minecraft.core.BlockPos.ZERO`.
  - Mutations: `SpeciesUtil.BEE_TYPE.get().getMutations().getAllMutations()` → `IMutation<IBeeSpecies>` (`getFirstParent()`, `getSecondParent()`, `getResult()` each `.id()`; `getChance()`; `getSpecialConditions()` → `List<Component>` already localized; `isSecret()`).

**Known v1 limitations (deliberate, per the minimal-mod principle):**
- **Jubilance/specialty *condition text* is not dumped** (`jubilance: ""`). The condition object is private with no public description accessor; specialty *items* are still dumped via `getSpecialties()`. Add later only if a description accessor is exposed.
- **Hive biome descriptions are not dumped.** Biome eligibility lives in imperative `isGoodBiome` overrides, not as data. The hive dump carries id + gen chance + climate + drops; human-readable biome blurbs live wiki-side in a hand-maintained `_data/hives.yml` (Plan C). This is a refinement of spec §4.1 (which sketched a `"biomes"` string) — recorded here as the agreed resolution.

---

## File structure

**Pure / MC-free (in `src/main/java`, import no `net.minecraft`; unit-tested):**
- `src/main/java/forestry/core/commands/wiki/dto/*.java` — dump DTO records (the JSON shape as Java types).
- `src/main/java/forestry/core/commands/wiki/PrincessChanceMath.java` — pure `double[]`→`double[]` math.
- `src/main/java/forestry/core/commands/wiki/WikiDumpFormat.java` — color hex + unresolved-key detection.
- `src/main/java/forestry/core/commands/wiki/WikiDumpGson.java` — configured Gson factory (pretty + snake_case).

**Game-dependent (in `src/main/java`, import MC + Forestry API; covered by GameTest):**
- `src/main/java/forestry/core/commands/wiki/WikiBeeDumpExtractor.java` — live registry → `BeeDump` DTO.
- `src/main/java/forestry/gametest/WikiBeeDumpGameTest.java` — GameTest exercising the extractor.

**Command wiring:**
- `src/main/java/forestry/core/commands/DumpCommand.java` — add `wiki_bees` subcommand (MODIFY).
- `src/main/java/forestry/core/commands/AllDataDump.java` — DELETE (logic harvested).

**Tests (MC-free):**
- `src/test/java/forestry/core/commands/wiki/PrincessChanceMathTest.java`
- `src/test/java/forestry/core/commands/wiki/WikiDumpFormatTest.java`
- `src/test/java/forestry/core/commands/wiki/BeeDumpSerializationTest.java`

---

## Task 0: Establish the working branch with the test harness

**Files:** `build.gradle` (verify/modify)

- [ ] **Step 1: Create the feature branch from a base that has the harness**

```bash
cd /home/thedarkcolour/IdeaProjects/ForestryCE/ForestryCE-1.20.1
git fetch --all
git checkout -b wiki-bee-dump feature/multiblock-redesign
```

(If the team prefers to base off a different branch, that branch MUST contain the `gameTestServer` run config, the JUnit deps, and the `test { useJUnitPlatform() }` block from `feature/multiblock-redesign`. If missing, add them verbatim from that branch's `build.gradle`.)

- [ ] **Step 2: Confirm the harness builds and runs**

Run: `./gradlew test`
Expected: PASS (the existing `SanityTest.onePlusOneIsTwo` and multiblock pattern tests run green; no Minecraft classpath needed).

Run: `./gradlew runGameTestServer`
Expected: a gametest server boots, runs the existing `@GameTestHolder("forestry")` suite, and exits. (Some existing multiblock tests may be known-red on this branch — that's fine; we only need the harness to execute.)

- [ ] **Step 3: Confirm Gson is available to the MC-free test source set**

The serialization unit test (Task 3) needs Gson on the test classpath. Check whether it resolves; if `./gradlew test` later fails to find `com.google.gson`, add to `build.gradle` `dependencies {}`:

```groovy
	// Gson for MC-free serialization unit tests (Gson ships with MC at runtime; tests need it explicitly).
	testImplementation 'com.google.code.gson:gson:2.10.1'
```

No commit yet (this is verification + optional one-line dep).

---

## Task 1: Pure princess-chance math

**Files:**
- Create: `src/main/java/forestry/core/commands/wiki/PrincessChanceMath.java`
- Test: `src/test/java/forestry/core/commands/wiki/PrincessChanceMathTest.java`

Harvest the math from `AllDataDump.computePrincessChances`, but as a pure function over a `double[]` of per-try drop chances, returning a `double[]` of conditional princess probabilities (one per drop, summing to 1.0 when any chance > 0). No Minecraft, no `IHiveDrop`.

- [ ] **Step 1: Write the failing test**

```java
package forestry.core.commands.wiki;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class PrincessChanceMathTest {
	private static final double EPS = 1e-9;

	@Test
	void singleDropIsCertain() {
		assertArrayEquals(new double[]{1.0}, PrincessChanceMath.probabilities(new double[]{0.8}), EPS);
	}

	@Test
	void twoEqualDropsSplitEvenly() {
		double[] p = PrincessChanceMath.probabilities(new double[]{0.5, 0.5});
		assertArrayEquals(new double[]{0.5, 0.5}, p, EPS);
	}

	@Test
	void probabilitiesSumToOne() {
		double[] p = PrincessChanceMath.probabilities(new double[]{0.8, 0.08, 0.08});
		double sum = 0;
		for (double x : p) sum += x;
		assertEquals(1.0, sum, EPS);
	}

	@Test
	void allZeroChancesReturnsZeros() {
		assertArrayEquals(new double[]{0.0, 0.0}, PrincessChanceMath.probabilities(new double[]{0.0, 0.0}), EPS);
	}

	@Test
	void emptyReturnsEmpty() {
		assertEquals(0, PrincessChanceMath.probabilities(new double[]{}).length);
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests 'forestry.core.commands.wiki.PrincessChanceMathTest'`
Expected: FAIL — `PrincessChanceMath` does not exist / compile error.

- [ ] **Step 3: Write the implementation**

```java
package forestry.core.commands.wiki;

/**
 * Pure math for the expected princess-species probability of each hive drop, accounting for the
 * uniform random shuffle used when a hive block is broken. Game-independent: operates on an array of
 * per-try drop chances and returns, for each drop, its conditional probability of being the princess
 * (conditioned on a princess dropping at all). Harvested from the original AllDataDump.
 */
public final class PrincessChanceMath {
	private PrincessChanceMath() {}

	/**
	 * @param chances per-drop success chance in [0,1], in drop-list order
	 * @return per-drop conditional princess probability, same order; sums to 1.0 when any chance > 0,
	 *         all zeros when every chance is 0, empty for empty input
	 */
	public static double[] probabilities(double[] chances) {
		int n = chances.length;
		if (n == 0) return new double[0];

		double pAny = 1.0;
		for (double pi : chances) pAny *= (1.0 - pi);
		pAny = 1.0 - pAny;
		if (pAny == 0.0) return new double[n];

		double[] perTry = new double[n];
		double[] e = new double[n];
		for (int i = 0; i < n; i++) {
			// elementary symmetric polynomials of {chances[j] : j != i}
			e[0] = 1.0;
			for (int k = 1; k < n; k++) e[k] = 0.0;
			for (int j = 0; j < n; j++) {
				if (j == i) continue;
				for (int k = Math.min(j < i ? j : j - 1, n - 2); k >= 0; k--) {
					e[k + 1] += e[k] * chances[j];
				}
			}
			double integral = 0.0;
			for (int k = 0; k < n; k++) {
				integral += (k % 2 == 0 ? 1.0 : -1.0) * e[k] / (k + 1);
			}
			perTry[i] = chances[i] * integral;
		}

		double[] result = new double[n];
		for (int i = 0; i < n; i++) result[i] = perTry[i] / pAny;
		return result;
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests 'forestry.core.commands.wiki.PrincessChanceMathTest'`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/java/forestry/core/commands/wiki/PrincessChanceMath.java src/test/java/forestry/core/commands/wiki/PrincessChanceMathTest.java
git commit -m "feat(wiki-dump): pure princess-chance math with unit tests"
```

---

## Task 2: Pure formatting helpers

**Files:**
- Create: `src/main/java/forestry/core/commands/wiki/WikiDumpFormat.java`
- Test: `src/test/java/forestry/core/commands/wiki/WikiDumpFormatTest.java`

- [ ] **Step 1: Write the failing test**

```java
package forestry.core.commands.wiki;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WikiDumpFormatTest {
	@Test
	void colorFormatsAsUppercaseSixDigitHex() {
		assertEquals("#19D0EC", WikiDumpFormat.color(0x19d0ec));
	}

	@Test
	void colorPadsLeadingZeros() {
		assertEquals("#0000FF", WikiDumpFormat.color(0x0000ff));
	}

	@Test
	void colorMasksAlphaBits() {
		assertEquals("#FFA12B", WikiDumpFormat.color(0xff_ffa12b));
	}

	@Test
	void detectsUnresolvedTranslationKeys() {
		assertTrue(WikiDumpFormat.looksUnresolved("allele.forestry.lifespan.10i"));
		assertTrue(WikiDumpFormat.looksUnresolved("for.mutation.condition.temperature.range"));
		assertTrue(WikiDumpFormat.looksUnresolved("chromosome.forestry.speed"));
	}

	@Test
	void acceptsResolvedDisplayStrings() {
		assertFalse(WikiDumpFormat.looksUnresolved("Shorter"));
		assertFalse(WikiDumpFormat.looksUnresolved("Average (9x6x9)"));
		assertFalse(WikiDumpFormat.looksUnresolved(""));
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests 'forestry.core.commands.wiki.WikiDumpFormatTest'`
Expected: FAIL — `WikiDumpFormat` not found.

- [ ] **Step 3: Write the implementation**

```java
package forestry.core.commands.wiki;

/** Game-independent string formatting for the wiki dump. */
public final class WikiDumpFormat {
	private WikiDumpFormat() {}

	/** Packed RGB int -> "#RRGGBB" uppercase, alpha bits masked off. */
	public static String color(int rgb) {
		return String.format("#%06X", rgb & 0xFFFFFF);
	}

	/**
	 * True if a "display" string is actually an unresolved translation key (the language pack was not
	 * loaded — e.g. the command was run on a dedicated server without client lang). Used to warn the
	 * operator that the dump should be re-run from singleplayer.
	 */
	public static boolean looksUnresolved(String display) {
		return display.startsWith("allele.") || display.startsWith("for.") || display.startsWith("chromosome.");
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests 'forestry.core.commands.wiki.WikiDumpFormatTest'`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/java/forestry/core/commands/wiki/WikiDumpFormat.java src/test/java/forestry/core/commands/wiki/WikiDumpFormatTest.java
git commit -m "feat(wiki-dump): color + unresolved-key formatting helpers"
```

---

## Task 3: Dump DTOs + Gson serialization

**Files:**
- Create: `src/main/java/forestry/core/commands/wiki/dto/BeeDump.java` (+ sibling records, see below)
- Create: `src/main/java/forestry/core/commands/wiki/WikiDumpGson.java`
- Test: `src/test/java/forestry/core/commands/wiki/BeeDumpSerializationTest.java`

The DTOs are plain Java records (no `net.minecraft` imports) whose field names map to the §4.1 JSON via Gson's `LOWER_CASE_WITH_UNDERSCORES` policy (`displayName` → `display_name`, `genChance` → `gen_chance`, etc.).

- [ ] **Step 1: Write the failing test**

```java
package forestry.core.commands.wiki;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import forestry.core.commands.wiki.dto.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BeeDumpSerializationTest {
	private static BeeDump sampleDump() {
		var trait = new TraitDump(10, "Shorter", "forestry:10i", false);
		var species = new SpeciesDump(
			"Forest", "Apis Forestis", "Apis", "Bees", "SirSengir", 3,
			false, true, false,
			new ColorsDump("#FFDC16", "#19D0EC", "#000000"),
			new ClimateDump("NORMAL", "NORMAL"),
			Map.of("lifespan", trait),
			List.of(new ProductDump("forestry:honey_comb", 0.30f, "Honey Comb")),
			List.of(),
			"");
		var hive = new HiveDump("forestry:forest", 6.0f, "NORMAL", "NORMAL",
			List.of(new DropDump("forestry:forest", 0.80, 0.70, 0.92, List.of())));
		var mutation = new MutationDump("forestry:forest", "forestry:meadows", "forestry:common",
			0.15f, false, List.of("Temperature between WARM and HOT"));
		return new BeeDump(
			new ManifestDump("1.0.0", List.of("forestry")),
			Map.of("forestry:forest", species),
			List.of(hive),
			List.of(mutation));
	}

	@Test
	void serializesToSnakeCaseContractShape() {
		String json = WikiDumpGson.create().toJson(sampleDump());
		JsonObject root = JsonParser.parseString(json).getAsJsonObject();

		assertTrue(root.has("manifest"));
		assertTrue(root.has("species"));
		assertTrue(root.has("hives"));
		assertTrue(root.has("mutations"));

		JsonObject forest = root.getAsJsonObject("species").getAsJsonObject("forestry:forest");
		assertEquals("Forest", forest.get("display_name").getAsString());
		assertEquals("#19D0EC", forest.getAsJsonObject("colors").get("stripes").getAsString());
		JsonObject lifespan = forest.getAsJsonObject("genome").getAsJsonObject("lifespan");
		assertEquals("Shorter", lifespan.get("display").getAsString());
		assertEquals("forestry:10i", lifespan.get("allele_id").getAsString());
		assertFalse(lifespan.get("dominant").getAsBoolean());

		JsonObject drop = root.getAsJsonArray("hives").get(0).getAsJsonObject()
			.getAsJsonArray("drops").get(0).getAsJsonObject();
		assertEquals(0.92, drop.get("princess_chance").getAsDouble(), 1e-9);
		assertTrue(drop.has("ignoble_chance"));

		JsonObject mut = root.getAsJsonArray("mutations").get(0).getAsJsonObject();
		assertEquals("forestry:common", mut.get("result").getAsString());
		assertEquals("Temperature between WARM and HOT",
			mut.getAsJsonArray("conditions").get(0).getAsString());
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests 'forestry.core.commands.wiki.BeeDumpSerializationTest'`
Expected: FAIL — DTOs / `WikiDumpGson` not found. (If failure is "cannot find com.google.gson", do Task 0 Step 3's `testImplementation` line.)

- [ ] **Step 3: Write the DTO records**

Create one file per record under `src/main/java/forestry/core/commands/wiki/dto/`. Field order = JSON key order (Gson preserves declaration order). `value` is `Object` so Gson serializes ints, floats, booleans, strings, and `int[]` (territory) by runtime type.

```java
// BeeDump.java
package forestry.core.commands.wiki.dto;
import java.util.List;
import java.util.Map;
public record BeeDump(ManifestDump manifest, Map<String, SpeciesDump> species,
                      List<HiveDump> hives, List<MutationDump> mutations) {}
```
```java
// ManifestDump.java
package forestry.core.commands.wiki.dto;
import java.util.List;
public record ManifestDump(String forestryVersion, List<String> mods) {}
```
```java
// SpeciesDump.java
package forestry.core.commands.wiki.dto;
import java.util.List;
import java.util.Map;
public record SpeciesDump(String displayName, String binomial, String genus, String family,
                          String authority, int complexity, boolean secret, boolean dominant,
                          boolean glint, ColorsDump colors, ClimateDump climate,
                          Map<String, TraitDump> genome, List<ProductDump> products,
                          List<ProductDump> specialties, String jubilance) {}
```
```java
// ColorsDump.java
package forestry.core.commands.wiki.dto;
public record ColorsDump(String body, String stripes, String outline) {}
```
```java
// ClimateDump.java
package forestry.core.commands.wiki.dto;
public record ClimateDump(String temperature, String humidity) {}
```
```java
// TraitDump.java
package forestry.core.commands.wiki.dto;
public record TraitDump(Object value, String display, String alleleId, boolean dominant) {}
```
```java
// ProductDump.java
package forestry.core.commands.wiki.dto;
public record ProductDump(String item, float chance, String display) {}
```
```java
// HiveDump.java
package forestry.core.commands.wiki.dto;
import java.util.List;
public record HiveDump(String id, float genChance, String temperature, String humidity,
                       List<DropDump> drops) {}
```
```java
// DropDump.java
package forestry.core.commands.wiki.dto;
import java.util.List;
public record DropDump(String species, double chance, double ignobleChance, double princessChance,
                       List<String> bonusItems) {}
```
```java
// MutationDump.java
package forestry.core.commands.wiki.dto;
import java.util.List;
public record MutationDump(String parent1, String parent2, String result, float chance,
                           boolean secret, List<String> conditions) {}
```

- [ ] **Step 4: Write the Gson factory**

```java
package forestry.core.commands.wiki;

import com.google.gson.FieldNamingPolicy;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

/** The single Gson configuration used to serialize the wiki dump (pretty + snake_case keys). */
public final class WikiDumpGson {
	private WikiDumpGson() {}

	public static Gson create() {
		return new GsonBuilder()
			.setPrettyPrinting()
			.setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
			.disableHtmlEscaping()
			.create();
	}
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `./gradlew test --tests 'forestry.core.commands.wiki.BeeDumpSerializationTest'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/forestry/core/commands/wiki/dto/ src/main/java/forestry/core/commands/wiki/WikiDumpGson.java src/test/java/forestry/core/commands/wiki/BeeDumpSerializationTest.java build.gradle
git commit -m "feat(wiki-dump): dump DTOs + Gson contract serialization"
```

---

## Task 4: Live-registry extractor

**Files:**
- Create: `src/main/java/forestry/core/commands/wiki/WikiBeeDumpExtractor.java`

Game-dependent; validated by the GameTest in Task 5 (no unit test). Builds a `BeeDump` from the live registries using the APIs listed in "Context".

- [ ] **Step 1: Confirm two extraction details against source before coding**

Read these to resolve the only uncertain bits:
- `forestry/api/apiculture/hives/IHive.java` and `forestry/apiculture/hives/HiveDefinition.java` — determine how to obtain a stable **hive identifier** string. Preferred: the template species id used at registration (e.g. `forestry:bee_forest`). If `IHive`/`IHiveDefinition` expose no id, derive from `getDefinition()` (enum `name()` lowercased) or the hive block's registry key. Document the choice in a code comment.
- `forestry/api/genetics/ITaxon.java` and `TaxonomicRank` — confirm `rank()` values and that walking `parent()` reaches a `FAMILY` rank. Family = first ancestor whose `rank()` is FAMILY; fall back to `""` if none.

- [ ] **Step 2: Write the extractor**

```java
package forestry.core.commands.wiki;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.Gson;

import forestry.api.IForestryApi;
import forestry.api.apiculture.genetics.IBeeSpecies;
import forestry.api.apiculture.hives.IHive;
import forestry.api.apiculture.hives.IHiveDrop;
import forestry.api.genetics.IGenome;
import forestry.api.genetics.ITaxon;
import forestry.api.genetics.IMutation;
import forestry.api.genetics.alleles.IAllele;
import forestry.api.genetics.alleles.IBooleanAllele;
import forestry.api.genetics.alleles.IFloatAllele;
import forestry.api.genetics.alleles.IIntegerAllele;
import forestry.api.genetics.alleles.IValueAllele;
import forestry.core.commands.wiki.dto.*;
import forestry.core.utils.SpeciesUtil;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Vec3i;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.EmptyBlockGetter;

/** Reads the live ForestryCE registries and builds the wiki {@link BeeDump}. Must run with registries loaded. */
public final class WikiBeeDumpExtractor {
	private WikiBeeDumpExtractor() {}

	public static BeeDump extract(String forestryVersion, List<String> loadedMods) {
		return new BeeDump(
			new ManifestDump(forestryVersion, loadedMods),
			extractSpecies(),
			extractHives(),
			extractMutations());
	}

	public static String extractJson(String forestryVersion, List<String> loadedMods) {
		Gson gson = WikiDumpGson.create();
		return gson.toJson(extract(forestryVersion, loadedMods));
	}

	private static Map<String, SpeciesDump> extractSpecies() {
		Map<String, SpeciesDump> out = new LinkedHashMap<>();
		for (IBeeSpecies species : SpeciesUtil.getAllBeeSpecies()) {
			out.put(species.id().toString(), new SpeciesDump(
				species.getDisplayName().getString(),
				species.getBinomial(),
				species.getGenus().name(),
				familyOf(species.getGenus()),
				species.getAuthority(),
				species.getComplexity(),
				species.isSecret(),
				species.isDominant(),
				species.hasGlint(),
				new ColorsDump(WikiDumpFormat.color(species.getBody()),
					WikiDumpFormat.color(species.getStripes()),
					WikiDumpFormat.color(species.getOutline())),
				new ClimateDump(species.getTemperature().name(), species.getHumidity().name()),
				extractGenome(species),
				extractProducts(species.getProducts()),
				extractProducts(species.getSpecialties()),
				""  /* jubilance condition text: deliberate v1 gap, see plan */));
		}
		return out;
	}

	@SuppressWarnings({"unchecked", "rawtypes"})
	private static Map<String, TraitDump> extractGenome(IBeeSpecies species) {
		Map<String, TraitDump> genome = new LinkedHashMap<>();
		IGenome g = species.getDefaultGenome();
		var karyotype = species.getKaryotype();
		for (var chromosome : karyotype.getChromosomes()) {
			if (chromosome == karyotype.getSpeciesChromosome()) continue;
			IAllele allele = g.getActiveAllele(chromosome);
			String key = chromosome.id().getPath();
			// Mirrors AllDataDump: chromosome.getDisplayName(allele.cast()) — no extra cast needed.
			String display = chromosome.getDisplayName(allele.cast()).getString();
			genome.put(key, new TraitDump(rawValue(allele), display,
				allele.alleleId().toString(), allele.dominant()));
		}
		return genome;
	}

	private static Object rawValue(IAllele allele) {
		if (allele instanceof IBooleanAllele b) return b.value();
		if (allele instanceof IIntegerAllele i) return i.value();
		if (allele instanceof IFloatAllele f) return f.value();
		if (allele instanceof IValueAllele<?> v) {
			Object value = v.value();
			if (value instanceof Vec3i vec) return new int[]{vec.getX(), vec.getY(), vec.getZ()};
			if (value instanceof Enum<?> e) return e.name();
			return String.valueOf(value);
		}
		return null;
	}

	private static List<ProductDump> extractProducts(List<forestry.api.core.IProduct> products) {
		List<ProductDump> out = new ArrayList<>();
		for (var p : products) {
			out.add(new ProductDump(
				BuiltInRegistries.ITEM.getKey(p.item()).toString(),
				p.chance(),
				new ItemStack(p.item()).getHoverName().getString()));
		}
		return out;
	}

	private static String familyOf(ITaxon genus) {
		for (ITaxon t = genus; t != null; t = t.parent()) {
			if ("FAMILY".equals(t.rank().name())) return t.name();
		}
		return "";
	}

	private static List<HiveDump> extractHives() {
		List<HiveDump> out = new ArrayList<>();
		for (IHive hive : IForestryApi.INSTANCE.getHiveManager().getHives()) {
			List<IHiveDrop> drops = hive.getDrops();
			double[] chances = new double[drops.size()];
			for (int i = 0; i < drops.size(); i++) {
				chances[i] = drops.get(i).getChance(EmptyBlockGetter.INSTANCE, BlockPos.ZERO, 0);
			}
			double[] princess = PrincessChanceMath.probabilities(chances);

			List<DropDump> dropDumps = new ArrayList<>();
			for (int i = 0; i < drops.size(); i++) {
				IHiveDrop d = drops.get(i);
				IBeeSpecies dropSpecies = d.createIndividual(EmptyBlockGetter.INSTANCE, BlockPos.ZERO).getSpecies();
				List<String> bonus = new ArrayList<>();
				for (ItemStack stack : d.getExtraItems(EmptyBlockGetter.INSTANCE, BlockPos.ZERO, 0)) {
					bonus.add(BuiltInRegistries.ITEM.getKey(stack.getItem()).toString());
				}
				dropDumps.add(new DropDump(dropSpecies.id().toString(), chances[i],
					d.getIgnobleChance(EmptyBlockGetter.INSTANCE, BlockPos.ZERO, 0), princess[i], bonus));
			}
			out.add(new HiveDump(hiveId(hive), hive.genChance(),
				/* temperature/humidity: from hive definition or template species — fill per Step 1 */
				null, null, dropDumps));
		}
		return out;
	}

	/** Stable hive identifier — implement per Task 4 Step 1 findings. */
	private static String hiveId(IHive hive) {
		// e.g. return template species id, or hive.getDefinition() enum name lowercased.
		return hive.getDefinition().toString();
	}

	private static List<MutationDump> extractMutations() {
		List<MutationDump> out = new ArrayList<>();
		for (IMutation<IBeeSpecies> m : SpeciesUtil.BEE_TYPE.get().getMutations().getAllMutations()) {
			List<String> conditions = new ArrayList<>();
			for (Component c : m.getSpecialConditions()) conditions.add(c.getString());
			out.add(new MutationDump(
				m.getFirstParent().id().toString(),
				m.getSecondParent().id().toString(),
				m.getResult().id().toString(),
				m.getChance(),
				m.isSecret(),
				conditions));
		}
		return out;
	}
}
```

> **Note for the executor:** the exact import paths for `IChromosome`, the `allele.cast()` idiom, and `IHive`/`ITaxon`/`IProduct` may differ slightly — cross-check against `AllDataDump.java` (which already compiles `chromosome.getDisplayName(allele.cast())` and the genome loop) and fix imports until it compiles. The `temperature`/`humidity` on `HiveDump` are placeholders (`null`) until Step 1 determines the cleanest source (likely `SpeciesUtil.getBeeSpecies(templateId).getTemperature()`); `null` serializes as JSON `null`, which is acceptable for v1 if the source proves awkward — but prefer filling it.

- [ ] **Step 3: Compile**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL (fix imports/idioms until it compiles). No commit yet — the GameTest in Task 5 is committed together with this in Task 5 Step 5.

---

## Task 5: GameTest — live-registry extraction

**Files:**
- Create: `src/main/java/forestry/gametest/WikiBeeDumpGameTest.java`

A GameTest boots a server with all registries loaded, so it validates the real extraction. It needs no world structure beyond the arena the harness provides — mirror the template declaration used by `MultiblockGameTests` (read its `@GameTest` annotations + the structure resource it points at, and reuse the smallest/empty one).

- [ ] **Step 1: Write the GameTest (this IS the failing test for the extractor)**

```java
package forestry.gametest;

import java.util.List;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import forestry.api.ForestryConstants;
import forestry.core.commands.wiki.WikiBeeDumpExtractor;

import net.minecraft.gametest.framework.GameTest;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraftforge.gametest.GameTestHolder;
import net.minecraftforge.gametest.PrefixGameTestTemplate;

@GameTestHolder(ForestryConstants.MOD_ID)
@PrefixGameTestTemplate(false)
public class WikiBeeDumpGameTest {

	// Mirror MultiblockGameTests convention: methods are `public static`, and the template name has NO
	// namespace prefix (the structure lives at src/main/resources/data/forestry/structures/empty.nbt).
	// Confirm the exact template name in Step 2.
	@GameTest(template = "empty", timeoutTicks = 100)
	public static void dumpConformsToContract(GameTestHelper helper) {
		String json = WikiBeeDumpExtractor.extractJson("test", List.of("forestry"));
		JsonObject root = JsonParser.parseString(json).getAsJsonObject();

		JsonObject species = root.getAsJsonObject("species");
		helper.assertTrue(species.size() > 0, "expected at least one bee species");

		// Every species has all 12 non-species chromosomes (assert against count, not a name list).
		for (String id : species.keySet()) {
			JsonObject genome = species.getAsJsonObject(id).getAsJsonObject("genome");
			helper.assertTrue(genome.size() == 12,
				"species " + id + " has " + genome.size() + " genome traits, expected 12");
		}

		// Every drop chance is a probability in [0,1].
		root.getAsJsonArray("hives").forEach(h ->
			h.getAsJsonObject().getAsJsonArray("drops").forEach(d -> {
				double c = d.getAsJsonObject().get("chance").getAsDouble();
				double pc = d.getAsJsonObject().get("princess_chance").getAsDouble();
				helper.assertTrue(c >= 0 && c <= 1, "drop chance out of range: " + c);
				helper.assertTrue(pc >= 0 && pc <= 1, "princess chance out of range: " + pc);
			}));

		// Every mutation parent/result id resolves to a dumped species.
		root.getAsJsonArray("mutations").forEach(m -> {
			JsonObject mo = m.getAsJsonObject();
			for (String key : List.of("parent1", "parent2", "result")) {
				helper.assertTrue(species.has(mo.get(key).getAsString()),
					"mutation " + key + " " + mo.get(key).getAsString() + " not in species map");
			}
		});

		helper.succeed();
	}
}
```

- [ ] **Step 2: Resolve the template reference**

Read `MultiblockGameTests.java` fully (`git show feature/multiblock-redesign:src/main/java/forestry/gametest/MultiblockGameTests.java`) to see how it names templates and where the `.snbt` lives (likely `src/main/resources/data/forestry/gametest/structures/` or generated via the `data` run). Reuse the same small/empty template name in the `@GameTest(template = ...)` above; if none is empty, create a 3x3x3 empty structure following that convention. The dump reads only registries, so any loadable arena works.

- [ ] **Step 3: Run the GameTest to verify it fails (extractor not yet compiling/complete) then passes**

Run: `./gradlew runGameTestServer`
Expected first run (if extractor incomplete): FAIL at `dumpConformsToContract`.
Iterate on `WikiBeeDumpExtractor` (Task 4) until:
Expected: `dumpConformsToContract` PASSES (look for it in the gametest summary output). 

If `genome.size() == 12` fails with 13, the species-chromosome filter is wrong — confirm `getSpeciesChromosome()` is excluded.

- [ ] **Step 4: Manual sanity look at the JSON shape (optional but recommended)**

Temporarily log `json` to `Forestry.LOGGER.info(...)` in the test, run once, and eyeball that it matches §4.1 (snake_case keys, `colors`, `genome`, `obtained_from` is NOT present — that's the wiki side). Remove the log before committing.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/forestry/core/commands/wiki/WikiBeeDumpExtractor.java src/main/java/forestry/gametest/WikiBeeDumpGameTest.java
# plus any new structure .snbt under src/main/resources/data/forestry/...
git commit -m "feat(wiki-dump): live-registry extractor + GameTest"
```

---

## Task 6: Wire the `wiki_bees` command + delete the WIP file

**Files:**
- Modify: `src/main/java/forestry/core/commands/DumpCommand.java`
- Delete: `src/main/java/forestry/core/commands/AllDataDump.java`

- [ ] **Step 1: Add the subcommand to `DumpCommand.register()`**

In the `register()` builder chain, add a sibling literal (do NOT touch `bee_species`). Match the file's existing Brigadier style:

```java
.then(Commands.literal("wiki_bees")
	.requires(source -> source.hasPermission(2))
	.executes(DumpCommand::wikiBees))
```

- [ ] **Step 2: Add the handler method**

Follow the file-writing pattern from `CommandSaveStats` (mkdirs, canWrite, UTF-8 BufferedWriter) and the feedback pattern (`ctx.getSource().sendSuccess(...)` / `CommandHelpers`).

```java
private static int wikiBees(CommandContext<CommandSourceStack> ctx) {
	List<String> mods = ModList.get().getMods().stream()
		.map(m -> m.getModId()).collect(Collectors.toList());
	String forestryVersion = ModList.get().getModContainerById(ForestryConstants.MOD_ID)
		.map(c -> c.getModInfo().getVersion().toString()).orElse("unknown");

	String json;
	try {
		json = WikiBeeDumpExtractor.extractJson(forestryVersion, mods);
	} catch (Exception ex) {
		Forestry.LOGGER.error("wiki_bees dump failed to extract", ex);
		ctx.getSource().sendFailure(Component.literal("Wiki bee dump failed: " + ex.getMessage()));
		return 0;
	}

	File file = new File("config/" + ForestryConstants.MOD_ID + "/wiki/bees.json");
	try {
		File folder = file.getParentFile();
		if (folder != null && !folder.exists() && !folder.mkdirs()) {
			ctx.getSource().sendFailure(Component.literal("Could not create " + folder));
			return 0;
		}
		try (BufferedWriter writer = new BufferedWriter(
				new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8))) {
			writer.write(json);
		}
	} catch (IOException ex) {
		Forestry.LOGGER.error("wiki_bees dump failed to write", ex);
		ctx.getSource().sendFailure(Component.literal("Wiki bee dump write failed: " + ex.getMessage()));
		return 0;
	}

	// Counts + unresolved-key warning for operator feedback.
	JsonObject root = JsonParser.parseString(json).getAsJsonObject();
	int speciesCount = root.getAsJsonObject("species").size();
	int hiveCount = root.getAsJsonArray("hives").size();
	int mutationCount = root.getAsJsonArray("mutations").size();
	ctx.getSource().sendSuccess(() -> Component.literal(String.format(
		"Wrote %s: %d species, %d hives, %d mutations", file.getPath(),
		speciesCount, hiveCount, mutationCount)), false);

	boolean unresolved = root.getAsJsonObject("species").entrySet().stream().anyMatch(e ->
		e.getValue().getAsJsonObject().getAsJsonObject("genome").entrySet().stream().anyMatch(t ->
			WikiDumpFormat.looksUnresolved(t.getValue().getAsJsonObject().get("display").getAsString())));
	if (unresolved) {
		ctx.getSource().sendSuccess(() -> Component.literal(
			"WARNING: some display names are unresolved translation keys. Re-run from singleplayer so the language pack is loaded.")
			.withStyle(ChatFormatting.YELLOW), false);
	}
	return 1;
}
```

Add the necessary imports (`com.mojang.brigadier.context.CommandContext`, `net.minecraft.commands.CommandSourceStack`, `net.minecraftforge.fml.ModList`, `java.io.*`, `java.nio.charset.StandardCharsets`, `java.util.stream.Collectors`, `net.minecraft.ChatFormatting`, `com.google.gson.*`, `forestry.core.commands.wiki.*`).

- [ ] **Step 3: Delete the WIP file**

```bash
git rm src/main/java/forestry/core/commands/AllDataDump.java
```

- [ ] **Step 4: Compile**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Manual in-game verification (the real acceptance test for the command)**

Run: `./gradlew runServer` (or `runClient` and open a singleplayer world — **singleplayer is required for resolved English display names**).
In the game/server console: `/forestry dump wiki_bees`
Expected: chat/console reports `Wrote config/forestry/wiki/bees.json: N species, M hives, K mutations`, no unresolved-key warning.
Then validate the file:

```bash
python3 -m json.tool run/server/config/forestry/wiki/bees.json > /dev/null && echo "valid JSON"
```

Spot-check `species["forestry:forest"]` against §4.1: `display_name` "Forest", `colors.stripes` a `#RRGGBB` string, `genome` has 12 entries each with `value`/`display`/`allele_id`/`dominant`, `products` lists `forestry:honey_comb`.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/forestry/core/commands/DumpCommand.java
git commit -m "feat(wiki-dump): /forestry dump wiki_bees command + remove WIP AllDataDump"
```

---

## Task 7: Full verification

- [ ] **Step 1: Unit tests green**

Run: `./gradlew test`
Expected: PASS (all `forestry.core.commands.wiki.*` tests + pre-existing tests).

- [ ] **Step 2: GameTest green**

Run: `./gradlew runGameTestServer`
Expected: `WikiBeeDumpGameTest.dumpConformsToContract` PASSES.

- [ ] **Step 3: Produce a real fixture for Plan C**

Run `/forestry dump wiki_bees` in singleplayer, then copy the output to the wiki repo as the fixture Plan C builds against:

```bash
cp run/server/config/forestry/wiki/bees.json \
   /home/thedarkcolour/WebstormProjects/forestry-wiki/test/fixtures/bees.sample.json
```

(Create the directory if needed. This real dump becomes the golden fixture for the sync-script tests in Plan C, decoupling C from needing the mod.)

- [ ] **Step 4: Done — hand off**

The mod side is complete: `config/forestry/wiki/bees.json` conforms to spec §4.1 and a real sample exists for Plan C.

---

## Definition of done

- `./gradlew test` and `./gradlew runGameTestServer` both pass.
- `/forestry dump wiki_bees` (singleplayer) writes valid §4.1-conforming JSON with no unresolved-key warning.
- The WIP `AllDataDump.java` is gone; the existing `bee_species` stats command is untouched.
- A real `bees.sample.json` fixture is committed to the wiki repo for Plan C.
