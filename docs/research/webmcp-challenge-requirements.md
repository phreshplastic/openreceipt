# WebMCP Challenge requirements

Checked August 31, 2026 against the official Devpost challenge page, official rules, challenge FAQ, and OpenAI challenge page. The repository did not have a research-notes convention, so this note lives under `docs/research/`.

## Deadline and judging window

- Registration and submissions close **September 3, 2026 at 1:00 p.m. Pacific / 4:00 p.m. Eastern**. Judging runs September 4 at 10:00 a.m. Pacific through September 21 at 5:00 p.m. Pacific, with winners expected on or around September 23 at 2:00 p.m. Pacific. [Official rules, section 1](https://webmcp.devpost.com/rules)
- The challenge FAQ gives the safest post-deadline instruction: after submissions close, do not change the Devpost entry, submitted repository, or live site until winners are announced. Continue only in a separate fork. [Official challenge FAQ](https://webmcp.devpost.com/resources)

## What the project and submission must include

- The entry must be a WebMCP-powered web app about humans and agents interacting, collaborating, and creating together. It must work consistently on its stated platform and behave as the video and description claim. [Official rules, section 4](https://webmcp.devpost.com/rules)
- A new project is eligible. A pre-existing project must have been meaningfully extended with WebMCP after the August 25 submission-period start, and the entry must clearly distinguish prior work from eligible new work with evidence such as dated commit history. [Official rules, section 4](https://webmcp.devpost.com/rules)
- The submission needs a working live URL accessible in ChatGPT's in-app browser or Chrome 149+ with WebMCP enabled. Authentication is allowed if judge credentials and testing instructions are supplied. The project must remain free and available for evaluation through the judging period; judges are not required to test it. [Official rules, section 4](https://webmcp.devpost.com/rules)
- The text description must explain why this use case fits WebMCP, how it improves the experience, what people and agents can now do together, and briefly how WebMCP was implemented. [Official challenge requirements](https://webmcp.devpost.com/)
- The public GitHub, GitLab, or Bitbucket repository must contain the source, assets, functional instructions, and a detectable open-source license visible at the top of its repository page. [Official challenge requirements](https://webmcp.devpost.com/)
- Third-party APIs, SDKs, data, software, and hardware must be used under their applicable terms and licenses. The project and submission must be original and must not infringe others' intellectual-property, privacy, or publicity rights. [Official rules, sections 4 and 8](https://webmcp.devpost.com/rules)
- All submission material must be in English or accompanied by an English translation. [Official rules, section 4](https://webmcp.devpost.com/rules)

## Required demo video

The video is not optional. It must:

- be **less than three minutes**; judges do not have to watch beyond three minutes;
- be uploaded to YouTube and made publicly visible, with its link entered on Devpost;
- clearly show the functioning project;
- include audio explaining what was built and how WebMCP was used; and
- exclude third-party trademarks, copyrighted music, and other copyrighted material unless the entrant has permission to use them.

Source: [Official rules, submission requirements](https://webmcp.devpost.com/rules). The [official challenge overview](https://webmcp.devpost.com/) restates the public-YouTube, audio, and under-three-minute requirements.

No rule requires an on-camera founder, a particular capture tool, or a continuous live take. A cut product-launch reel, a Loom-style walkthrough, or a hybrid is acceptable as long as the final video satisfies the points above and accurately depicts the submitted build.

## Judging criteria

Stage one is pass/fail: the project must fit the theme and reasonably apply WebMCP. Stage two uses four **equally weighted** criteria:

1. **WebMCP leverage:** thorough, skillful, working, non-trivial use of WebMCP.
2. **Execution:** a runnable, complete, coherent product experience rather than a technical proof of concept.
3. **Potential impact:** a credible, specific problem and audience, with a demonstrated solution.
4. **Creativity and ambition:** a novel concept distinct from existing ones.

WebMCP leverage is the first tie-break criterion, followed in order by the others. Judges may evaluate from the description, images, repository, and video without testing the live app, so the video must carry the central case on its own. [Official rules, sections 4 and 7](https://webmcp.devpost.com/rules)

OpenAI summarizes the same judging intent as usefulness, originality, execution, thoughtful WebMCP use, and the quality of the human-agent experience. [OpenAI challenge FAQ](https://openai.com/webmcp-challenge/)

## Practical implications for Pete's Printer

- Use a **hybrid launch reel**: polished titles and licensed/original jazz for pace, direct screen capture for proof, then a real camera shot of the thermal printer and finished receipt. A face intro is optional and should only stay if it makes the problem and audience clearer faster than product footage.
- Target **2:30–2:45**, not 2:59, to leave export and platform timing margin. The first 15 seconds should show the agent-to-paper payoff; the middle should prove a non-trivial WebMCP collaboration; the ending should show approval, printing, and the physical artifact.
- Make the human-agent loop visible: the agent drafts through registered tools, the person reviews or edits in the same receipt, a consequential print requires approval, and the paper appears. That single flow can substantiate all four judging criteria without becoming a feature inventory.
- Spend spoken time on the mechanism: the browser exposes structured receipt tools through WebMCP, both human and agent operate the same revision-checked document, and printing is permission-gated. Tool names or one compact registration/code shot can prove WebMCP leverage, but the interaction should remain the main evidence.
- Treat “Claude-style” as pacing and visual inspiration only. Do not use Claude/Anthropic names, logos, interface assets, launch footage, or music without permission. Use music that is original, commissioned, or explicitly licensed for a public promotional YouTube video, and keep it beneath the narration.
- Show the physical print clearly because the hardware payoff is the project's most legible proof of execution. The rules also reserve the right to request physical access when proprietary or third-party hardware is not widely available, so the live URL and video should demonstrate a useful software experience even if a judge does not have the Epson printer. [Official rules, testing](https://webmcp.devpost.com/rules)
- Freeze and archive the exact submitted cut, repository commit, and deployed build before **September 3 at 4:00 p.m. Eastern**. The visible local history currently begins inside the eligibility window, but the submission should still state what was built during the challenge and link the dated commits.

