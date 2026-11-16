import React from 'react'
import '../styles/dna.css'

export default function DnaLearnView({ onSwitchView }) {
  return (
    <div className="view-page dna-page">
      <div className="view-container dna-container">
        <div className="view-header">
          <div>
            <h1>Learn about DNA testing</h1>
            <p className="view-sub">What your DNA can tell your family — and what it can&rsquo;t</p>
          </div>
          <button className="btn btn-primary" onClick={() => onSwitchView('dna')}>
            <i className="fas fa-dna" aria-hidden="true"></i> DNA overview
          </button>
        </div>

        {/* Hero note */}
        <div className="view-card dna-hero">
          <div className="dna-hero-icon" aria-hidden="true"><i className="fas fa-dna"></i></div>
          <div>
            <h2>TheWairuaHeritage and DNA, honestly</h2>
            <p>
              Many families use DNA kits to discover relatives they never knew existed, or to settle questions about
              which branch of the tree is really theirs. This page explains how that works and what it means for our
              family. <strong>No DNA provider lets outside apps see your raw DNA or your match list through a public API,
              so TheWairuaHeritage cannot show matches inside the app today.</strong> What we can do is keep the family
              informed, remember who has tested, and host a family match list if you choose to share your kit results.
            </p>
          </div>
        </div>

        <div className="dna-grid">
          {/* What it can tell you */}
          <section className="view-card dna-card">
            <h2><i className="fas fa-check-circle" aria-hidden="true"></i> What DNA can tell you</h2>
            <ul className="dna-list pos">
              <li><strong>Your ethnic ancestry breakdown.</strong> A percentage readout of the regions your ancestors came from — e.g. Kikuyu highlands, Western Kenya, Uganda, West Africa, Europe — based on reference populations. Useful as a guide, not gospel.</li>
              <li><strong>DNA matches.</strong> The provider compares your DNA to everyone in their database and predicts relationships (2nd–5th cousin, half-sibling, etc.). This is how &ldquo;unknown&rdquo; branches get found.</li>
              <li><strong>Line confirmation.</strong> Y-DNA (father → son) tests the male line; mtDNA tests the maternal line. Either can confirm or break a suspected line of descent.</li>
              <li><strong>Deep origins.</strong> Test companies assign haplogroups to Y-DNA and mtDNA, tying your line to ancient migration routes.</li>
            </ul>
          </section>

          {/* What it can't tell you */}
          <section className="view-card dna-card">
            <h2><i className="fas fa-triangle-exclamation" aria-hidden="true"></i> What DNA cannot tell you</h2>
            <ul className="dna-list neg">
              <li><strong>Where, exactly.</strong> DNA hints at broad regions, not a birthplace — that&rsquo;s what archives and oral history are for.</li>
              <li><strong>Guaranteed matches.</strong> Match quality depends on who else has tested. African-reference datasets are smaller than European ones, so percentages wobble between providers and can change as science improves.</li>
              <li><strong>Parentage proof on its own.</strong> A DNA link plus documents make a case; DNA alone is one piece of evidence.</li>
              <li><strong>Medical certainty.</strong> Consumer kits are not clinical tests. A result of &ldquo;higher risk&rdquo; is a nudge to see a doctor, not a diagnosis.</li>
            </ul>
          </section>
        </div>

        {/* Test types */}
        <section className="view-card dna-card">
          <h2>The three kinds of test</h2>
          <div className="dna-types">
            <div className="dna-type">
              <h3><i className="fas fa-users" aria-hidden="true"></i> Autosomal</h3>
              <p><strong>Everyone can take it.</strong> Uses cheek swabs (saliva). Inherited ~50% from each parent, so it fades each generation. Best for cousin matching to roughly the 4th–5th degree.</p>
              <p className="dna-kv"><span>Best for</span> Finding living relatives &amp; ethnicity <span>Cost</span> Most popular tier, ~$79–99</p>
            </div>
            <div className="dna-type">
              <h3><i className="fas fa-mars" aria-hidden="true"></i> Y-DNA</h3>
              <p><strong>Men only</strong> (passed father → son, almost unchanged). Useful for paternal-line research: surname clusters, haplogroups, family migrations. Not needed for ordinary cousin hunting.</p>
              <p className="dna-kv"><span>Best for</span> Proving a surname line <span>Cost</span> ~$119 and up (e.g. FamilyTreeDNA Y-37/Y-67/Big Y)</p>
            </div>
            <div className="dna-type">
              <h3><i className="fas fa-venus" aria-hidden="true"></i> mtDNA</h3>
              <p><strong>Absolutely everyone can take it</strong> (mother passes it to all children; only daughters keep passing it down). Traces the maternal line for thousands of years.</p>
              <p className="dna-kv"><span>Best for</span> Maternal migration history <span>Cost</span> ~$89–159</p>
            </div>
          </div>
        </section>

        {/* Providers */}
        <section className="view-card dna-card">
          <h2>Who offers kits, and what it&rsquo;s like from Kenya</h2>
          <p className="dna-note">
            No major consumer DNA lab operates in Kenya today. Kits are ordered online, cheek swabs are collected at
            home (it takes minutes) and return postage is usually covered or prepaid by the company. Expect 4–8 weeks
            from sample to results. Confirm current shipping availability at checkout — provider policies and prices change.
          </p>
          <div className="dna-providers">
            <div className="dna-provider">
              <h3>MyHeritage DNA</h3>
              <p>Pairs naturally with our MyHeritage site and family tree; ethnicity + cousin matching. Frequent sales.</p>
            </div>
            <div className="dna-provider">
              <h3>AncestryDNA</h3>
              <p>The largest DNA database by kit count — best raw pool for obscure matches. Ancestry subscription not required for basic DNA results.</p>
            </div>
            <div className="dna-provider">
              <h3>23andMe</h3>
              <p>Health + ancestry in one kit. Notably relevant in East Africa: carrier-trait screening (e.g. sickle-cell, G6PD) is included. Not a clinical service.</p>
            </div>
            <div className="dna-provider">
              <h3>FamilyTreeDNA</h3>
              <p>Specialist for Y-DNA and mtDNA (deep-line research) plus a Family Finder autosomal test.</p>
            </div>
          </div>
          <p className="dna-note dna-fine">
            Prices are typically $79–199 and drop sharply during holiday sales. Purchasing: honest answer, none of us
            here get paid or discounted for any provider — choose on database size and features that matter to <em>your</em> branch.
          </p>
        </section>

        {/* Privacy */}
        <section className="view-card dna-card dna-privacy">
          <h2><i className="fas fa-shield-halved" aria-hidden="true"></i> Before you swab: read this</h2>
          <ol className="dna-steps">
            <li><strong>Your DNA is not only yours.</strong> It reveals relatives who never consented — undocumented half-siblings included. Talk with close family first.</li>
            <li><strong>Genetic data is sensitive.</strong> In Kenya, the Data Protection Act 2019 treats genetic data as sensitive personal data — companies operating here must justify how they use it.</li>
            <li><strong>Use a unique password + 2FA.</strong> In 2023, 23andMe disclosed a credential-stuffing breach that exposed millions of profiles whose passwords were reused. Unique passwords fix that entire class of attack.</li>
            <li><strong>Read the research consent box.</strong> Most providers default to using your DNA for research. You can usually opt out in account settings.</li>
            <li><strong>GEDmatch and lookalike tools</strong> let you upload raw DNA files. Convenient, public-ish and impossible to fully unpublish. Think before you upload.</li>
          </ol>
        </section>

        {/* Roadmap */}
        <section className="view-card dna-card">
          <h2>What TheWairuaHeritage could add (and what it will never do)</h2>
          <p className="dna-never"><i className="fas fa-ban" aria-hidden="true"></i><span><strong>Never:</strong> storing raw DNA files, guessing medical risk, or selling data — those are permanent, non-negotiable no&rsquo;s.</span></p>
          <p className="dna-can"><i className="fas fa-circle-check" aria-hidden="true"></i><span><strong>Possible, once members want it:</strong></span></p>
          <ul className="dna-list">
            <li>A &ldquo;DNA tested&rdquo; badge on member profiles (opt-in, self-reported).</li>
            <li>A private family DNA-matches page: you paste your kit&rsquo;s visible match list (or just the kit name), and we help spot shared Wairua surnames.</li>
            <li>Names of who was tested + kit company, kept to the family only, so relatives know where to look before ordering a second one.</li>
          </ul>
          <p className="dna-note">None of this exists yet — it ships only when members ask for it. Tell the administrator if you want it.</p>
        </section>

        {/* FAQ */}
        <section className="view-card dna-card">
          <h2>Common questions</h2>
          <div className="dna-faq">
            <div>
              <h3>Do my relatives have to consent?</h3>
              <p>Adults consent individually. Testing a minor without guardian consent is not done by providers; grandparents/aunties/uncles can be tested with their own consent — they carry 25% of a grandchild&rsquo;s DNA and often the missing link.</p>
            </div>
            <div>
              <h3>Will this find my guardian for me if it was informal adoption?</h3>
              <p>Make no secret: it can and has. Matching usually works through two or three shared cousins who triangulate the link. Emotionally prepare before testing — you may learn something you preferred not to know, or find exactly who you hoped for.</p>
            </div>
            <div>
              <h3>Can I upload my raw DNA file to several sites?</h3>
              <p>Yes — most big providers let you download a raw file and upload it free to others (e.g. FamilyTreeDNA, GEDmatch) to multiply matches. Understand each site&rsquo;s privacy rules before you do.</p>
            </div>
            <div>
              <h3>What does African ancestry reporting look like?</h3>
              <p>It will say &ldquo;East African&rdquo; / &ldquo;West African&rdquo; / &ldquo;Bantu&rdquo; etc., sometimes down to country-level groups. It will not name your village. Use it alongside documents, not instead of them.</p>
            </div>
            <div>
              <h3>How much would we spend, realistically?</h3>
              <p>Autosomal kit $79–99 on sale (common four times a year). Budget extra if you later want Y-DNA/mtDNA. Returns/postage from Kenya is often subsidised or free — check at checkout.</p>
            </div>
            <div>
              <h3>Health vs ancestry?</h3>
              <p>Most people here buy ancestry. 23andMe adds FDA-authorized health traits; for real health questions, see a clinician — these kits steer, they don&rsquo;t diagnose.</p>
            </div>
          </div>
        </section>

        <p className="dna-disclaimer">
          This is general family-history information, not medical, legal or genetic-counselling advice. Provider prices,
          shipping rules and features change; verify on the provider&rsquo;s website before purchasing. TheWairuaHeritage
          is not affiliated with, endorsed by, or receiving referral fees from any DNA company mentioned.
        </p>

        <div className="dna-actions">
          <button className="btn btn-primary" onClick={() => onSwitchView('dna')}><i className="fas fa-arrow-left" aria-hidden="true"></i> Back to DNA overview</button>
          <button className="btn btn-outline" onClick={() => onSwitchView('tree')}><i className="fas fa-sitemap" aria-hidden="true"></i> Browse the family tree</button>
        </div>
      </div>
    </div>
  )
}
