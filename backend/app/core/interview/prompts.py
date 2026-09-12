import random
from typing import Optional

from app.core.interview.constants import (
    COMPANY_PROFILES,
    get_role_category,
    TECHNICAL_CHALLENGE_BANKS,
    TECH_FUNDAMENTALS_BY_CATEGORY,
    SYSTEM_DESIGNS_BY_CATEGORY,
    COMPANY_DESIGN_SCENARIOS,
    PHASE_2_TOPICS,
    PHASE_3_NAMES,
    PHASE_5_NAMES,
    PHASE_5_FOCUS
)


def _build_interview_system_prompt(
    role: str,
    company: str,
    company_style: str,
    company_tier: str,
    interview_type: str = "technical",
    resume_summary: str | None = None,
    candidate_name: str = "Candidate",
    session_id: str | None = None,
    role_level: str = "fresher"
) -> str:
    target_company_lower = company.lower()
    category = get_role_category(role)
    
    # Use session-based seeding to guarantee consistency during page reloads/reconnects,
    # but total randomness across different sessions.
    local_random = random.Random(session_id) if session_id else random

    # ── Difficulty Logic: role_level is PRIMARY, company_tier is secondary ──
    tier = (company_tier or "other").lower()

    # Base difficulty from role level
    ROLE_LEVEL_BASE_DIFFICULTY = {
        "intern": "EASY",
        "fresher": "EASY",
        "mid": "MEDIUM",
        "senior": "HARD",
    }
    base_diff = ROLE_LEVEL_BASE_DIFFICULTY.get(role_level, "EASY")

    # Premium companies bump difficulty up one notch (capped at HARD)
    DIFFICULTY_ORDER = ["EASY", "MEDIUM", "HARD"]
    difficulty_level = base_diff
    if tier in ["faang", "hft", "top-indian-product", "fintech", "hardware", "gaming", "security"]:
        idx = DIFFICULTY_ORDER.index(base_diff)
        difficulty_level = DIFFICULTY_ORDER[min(idx + 1, len(DIFFICULTY_ORDER) - 1)]

    # Select 1 random problem from the category bank for this difficulty
    bank = TECHNICAL_CHALLENGE_BANKS.get(category, TECHNICAL_CHALLENGE_BANKS["swe"])

    # ── Role-level question bank overrides ──────────────────────────────
    # For intern/fresher: supplement with INTERVIEW_FUNDAMENTALS (easier warm-ups)
    # to ensure questions are approachable
    INTERVIEW_FUNDAMENTALS = {
        "swe": [
            {"title": "Two Sum", "id": "#1", "description": "Given an array of integers and a target, return indices of two numbers that add up to the target.", "concepts": ["Hash Map", "Array"], "optimizations": ["O(n) time with Hash Map"]},
            {"title": "Valid Parentheses", "id": "#20", "description": "Given a string containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.", "concepts": ["Stack"], "optimizations": ["O(n) time and space"]},
            {"title": "Reverse Linked List", "id": "#206", "description": "Reverse a singly linked list. Explain the pointer manipulation step by step.", "concepts": ["Linked List", "Pointers"], "optimizations": ["O(n) time, O(1) space"]},
            {"title": "Fibonacci Number", "id": "#509", "description": "Calculate the nth Fibonacci number. Discuss both recursive and iterative approaches.", "concepts": ["Recursion", "DP", "Iteration"], "optimizations": ["O(n) time, O(1) space iterative"]},
            {"title": "Palindrome Check", "id": "#125", "description": "Determine if a string is a palindrome, considering only alphanumeric characters.", "concepts": ["Two Pointers", "String"], "optimizations": ["O(n) time, O(1) space"]},
            {"title": "Maximum Subarray", "id": "#53", "description": "Find the contiguous subarray with the largest sum and return its sum.", "concepts": ["Kadane's Algorithm"], "optimizations": ["O(n) time, O(1) space"]},
            {"title": "Merge Sorted Arrays", "id": "#88", "description": "Merge two sorted arrays in-place into the first array.", "concepts": ["Two Pointers", "Array"], "optimizations": ["O(n+m) time"]},
            {"title": "Count Occurrences", "id": "#387", "description": "Find the first non-repeating character in a string and return its index.", "concepts": ["Hash Map", "String"], "optimizations": ["O(n) time"]},
            {"title": "Binary Search", "id": "#704", "description": "Implement binary search to find a target in a sorted array.", "concepts": ["Binary Search", "Array"], "optimizations": ["O(log n) time"]},
            {"title": "Stack Implementation", "id": "#155", "description": "Design a stack that supports push, pop, top, and retrieving the minimum element in O(1).", "concepts": ["Stack", "Auxiliary DS"], "optimizations": ["O(1) for all ops"]},
        ],
        "data_ai": [
            {"title": "Mean/Median/Mode", "id": "#STATS-1", "description": "Calculate mean, median, and mode of a dataset. When would you use each?", "concepts": ["Descriptive Statistics"], "optimizations": ["O(n log n) for median"]},
            {"title": "Linear Regression from Scratch", "id": "#ML-1", "description": "Implement simple linear regression using gradient descent. Explain the loss function.", "concepts": ["Gradient Descent", "Loss Function"], "optimizations": ["Learning rate tuning"]},
            {"title": "SQL Aggregation", "id": "#SQL-1", "description": "Write a query to find the top 3 customers by total order value using GROUP BY and HAVING.", "concepts": ["SQL", "Aggregation"], "optimizations": ["Index optimization"]},
            {"title": "Bias vs Variance", "id": "#ML-2", "description": "Explain the bias-variance tradeoff. How does model complexity affect each?", "concepts": ["Model Selection", "Overfitting"], "optimizations": ["Cross-validation"]},
            {"title": "Precision vs Recall", "id": "#ML-3", "description": "Explain precision, recall, and F1-score. When would you prioritize one over the other?", "concepts": ["Classification Metrics"], "optimizations": ["Threshold tuning"]},
            {"title": "Correlation vs Causation", "id": "#STATS-2", "description": "What is the difference between correlation and causation? Give a real-world example of each.", "concepts": ["Statistics", "Experimental Design"], "optimizations": ["Observational studies vs A/B testing"]},
            {"title": "Train/Test Split", "id": "#ML-4", "description": "Why do we split data into train and test sets? What happens if we don't?", "concepts": ["Model Evaluation", "Overfitting"], "optimizations": ["Stratified splitting"]},
            {"title": "One-Hot Encoding", "id": "#FE-1", "description": "When and why would you use one-hot encoding for categorical variables? What are its drawbacks?", "concepts": ["Feature Engineering", "Categorical Data"], "optimizations": ["Dimensionality reduction"]},
            {"title": "SQL Joins", "id": "#SQL-2", "description": "Explain INNER JOIN, LEFT JOIN, and FULL OUTER JOIN with examples. When would you use each?", "concepts": ["SQL", "Relational Algebra"], "optimizations": ["Join order optimization"]},
            {"title": "Confusion Matrix", "id": "#ML-5", "description": "Draw a confusion matrix and explain TP, FP, TN, FN. How do accuracy, precision, and recall relate to it?", "concepts": ["Classification Metrics"], "optimizations": ["Threshold adjustment"]},
        ],
        "infra_cloud": [
            {"title": "What is a Container?", "id": "#DOCKER-1", "description": "Explain the difference between a container and a virtual machine. When would you use each?", "concepts": ["Containers", "Virtualization"], "optimizations": ["Image layer caching"]},
            {"title": "HTTP Status Codes", "id": "#NET-1", "description": "Explain the difference between 200, 301, 304, 400, 401, 403, 404, and 500 status codes.", "concepts": ["HTTP", "Web Fundamentals"], "optimizations": ["Cache-Control headers"]},
            {"title": "DNS Resolution", "id": "#NET-2", "description": "Walk through what happens when you type a URL in a browser, from DNS to rendering.", "concepts": ["DNS", "Networking", "Web"], "optimizations": ["DNS caching"]},
            {"title": "Linux Permissions", "id": "#LINUX-1", "description": "Explain Unix file permissions (rwx). What does chmod 755 mean?", "concepts": ["Linux", "File System"], "optimizations": ["Least privilege principle"]},
            {"title": "What is CI/CD?", "id": "#CICD-1", "description": "Explain continuous integration and continuous deployment. Why are they important?", "concepts": ["CI/CD", "DevOps"], "optimizations": ["Pipeline parallelization"]},
        ],
        "security": [
            {"title": "OWASP Top 10", "id": "#OWASP-1", "description": "Name the top 3 OWASP web application security risks and how to prevent each.", "concepts": ["OWASP", "Web Security"], "optimizations": ["Input validation"]},
            {"title": "SQL Injection", "id": "#SEC-1", "description": "What is SQL injection? Show an example of vulnerable code and how to fix it.", "concepts": ["SQL Injection", "Input Validation"], "optimizations": ["Parameterized queries"]},
            {"title": "HTTPS vs HTTP", "id": "#SEC-2", "description": "Explain the difference between HTTP and HTTPS. What does TLS/SSL do?", "concepts": ["TLS/SSL", "Encryption"], "optimizations": ["Certificate pinning"]},
            {"title": "Authentication vs Authorization", "id": "#SEC-3", "description": "What is the difference between authentication and authorization? Give examples of each.", "concepts": ["Auth", "Access Control"], "optimizations": ["RBAC vs ABAC"]},
            {"title": "What is a Firewall?", "id": "#SEC-4", "description": "Explain what a firewall does and the difference between network and application firewalls.", "concepts": ["Firewall", "Network Security"], "optimizations": ["Rule ordering"]},
        ],
    }

    # For intern/fresher, prefer fundamentals over the full bank
    if role_level in ("intern", "fresher") and category in INTERVIEW_FUNDAMENTALS:
        if difficulty_level == "EASY":
            # Use fundamentals pool for intern/fresher at EASY
            p1 = local_random.choice(INTERVIEW_FUNDAMENTALS[category])
        elif difficulty_level == "MEDIUM":
            # For fresher at FAANG: mix fundamentals with easy bank
            pool = INTERVIEW_FUNDAMENTALS[category] + bank.get("EASY", [])
            p1 = local_random.choice(pool)
        else:
            p1 = local_random.choice(bank["EASY"])
    else:
        p1 = local_random.choice(bank[difficulty_level])

    # ── Persona Logic ──────────────────────────────────────────────────
    TECHNICAL_PERSONAS = [
        "a FAANG Senior Staff Engineer who values scalability and deep technical mastery",
        "a rigorous system architect who focuses on trade-offs and edge cases",
        "a startup CTO who cares about speed, clean code, and solving real-world bugs"
    ]
    BEHAVIORAL_PERSONAS = [
        "an empathetic Hiring Manager who looks for leadership potential and EQ",
        "a culture-focused director who values collaboration, mentorship, and values-alignment",
        "a professional HRBP who evaluates communication, conflict resolution, and growth mindset"
    ]
    
    interviewer_persona = local_random.choice(TECHNICAL_PERSONAS if interview_type == "technical" else BEHAVIORAL_PERSONAS)

    # ── Random Focus Topics (By Category for variety) ──────────────────
    NON_TECH_FUNDAMENTALS = [
        "metrics prioritization (activation, retention, LTV, North Star metric selection)",
        "user research methodology (qualitative vs quantitative, usability testing, persona design)",
        "product execution and roadmap trade-offs (MoSCoW method, RICE scoring framework)",
        "design system consistency and accessibility standards (WCAG guidelines, contrast, responsive grids)",
        "stakeholder alignment and conflict resolution during feature scoping",
        "analytical problem-solving (market sizing, product launch GTM strategy, pricing models)"
    ]

    fundamental_focus = local_random.choice(
        TECH_FUNDAMENTALS_BY_CATEGORY.get(category, TECH_FUNDAMENTALS_BY_CATEGORY["swe"])
        if interview_type == "technical" else NON_TECH_FUNDAMENTALS
    )

    # ── Random System Design Scenarios (By Tier/Company for Variety) ───────
    # For intern/fresher: use simpler, more accessible scenarios
    JUNIOR_DESIGN_SCENARIOS = {
        "swe": [
            "design a URL shortener like bit.ly",
            "design a simple chat application like WhatsApp",
            "design a task scheduling system like a to-do list app",
            "design a file upload and sharing service like Google Drive",
            "design a rate limiter for an API gateway",
            "design a basic search autocomplete feature",
            "design a notification system that sends emails and SMS",
            "design a simple blog platform with comments",
            "design a parking lot reservation system",
            "design a library book checkout system",
        ],
        "data_ai": [
            "design a daily active user analytics dashboard",
            "design a recommendation system for a movie website",
            "design a real-time vote counting system",
            "design an A/B testing platform",
            "design a data pipeline that cleans and transforms CSV uploads",
            "design a real-time anomaly detection dashboard",
        ],
        "infra_cloud": [
            "design a simple log aggregation system",
            "design a deployment pipeline for a monolith app",
            "design a health check monitoring system for 50 servers",
            "design a container image registry",
        ],
        "security": [
            "design a password reset flow with email verification",
            "design a simple API key management system",
            "design a login rate limiter to prevent brute force attacks",
        ],
    }

    if role_level in ("intern", "fresher") and category in JUNIOR_DESIGN_SCENARIOS:
        system_design_scenario = local_random.choice(JUNIOR_DESIGN_SCENARIOS[category])
    else:
        scenarios = COMPANY_DESIGN_SCENARIOS.get(tier, COMPANY_DESIGN_SCENARIOS["other"])
        raw_scenario = local_random.choice(scenarios)
        try:
            system_design_scenario = raw_scenario.format(company=company)
        except Exception:
            system_design_scenario = raw_scenario

    # Generate a unique seed to prevent LLM caching/repetition
    seed_token = local_random.randint(1000, 9999)

    # ── Phase Naming & Details ────────────────────────────────────────
    p2_name = PHASE_2_TOPICS.get(category, PHASE_2_TOPICS["swe"])

    if category == "swe":
        p3_desc = f"Phase 3: LeetCode Coding Challenge - {p1['title']}. Instructions: Introduce the problem {p1['description']}. Explicitly state that this is similar to the standard LeetCode problem. Ask the candidate to explain their approach and provide the code logic (focusing on {', '.join(p1['concepts'])} and complexity analysis)."
    else:
        ch_name = PHASE_3_NAMES.get(category, "Technical Case Study")
        p3_desc = f"Phase 3: {ch_name} - {p1['title']}. Instructions: Present the scenario: {p1['description']}. Ask the candidate to walk through their solution/logic, covering core concepts ({', '.join(p1['concepts'])}), key decisions, and potential optimization trade-offs."

    # ── Mode-Specific Instructions ─────────────────────────────────────
    if interview_type == "technical":
        if category == "swe":
            mode_instructions = (
                "FOCUS: ONLY TECHNICAL ASSESSMENT.\n"
                "- Deep dive into Data Structures, Algorithms, and System Design (LLD/HLD).\n"
                "- Ask about code optimization, time/space complexity, and scalability.\n"
                "- IMPORTANT: When asking a coding challenge, EXPLICITLY state the standard LeetCode problem name or number (e.g., 'This problem is similar to LeetCode 1: Two Sum'). Do this so the candidate clearly understands the reference.\n"
                f"- Evaluate their ability to solve complex engineering problems for a {role}.\n"
                "- Discuss architecture, trade-offs, and company-specific tech stacks."
            )
        else:
            challenge_focus_text = {
                "data_ai": "ML modeling, statistics, data pipelines, model optimization, and evaluation metrics",
                "infra_cloud": "infrastructure design, container orchestration, CI/CD pipelines, and cloud security",
                "security": "vulnerability remediation, cryptography, threat modeling, and incident response",
                "product_design": "product sense, feature prioritization metrics, wireframing decisions, and growth strategy",
                "gaming": "game loop architecture, rendering pipelines, physics optimization, and netcode",
                "specialized": "domain-specific technologies, automation frameworks, blockchain consensus, or embedded limits"
            }.get(category, "core domain engineering principles")
            
            mode_instructions = (
                "FOCUS: ONLY TECHNICAL ASSESSMENT.\n"
                f"- Deep dive into technical concepts relevant to {role}, including {challenge_focus_text}.\n"
                "- Ask about practical scenario debugging, solution logic, and design trade-offs.\n"
                "- IMPORTANT: Present the challenge as a realistic domain-specific scenario. Ask the candidate to explain their methodology, architectural decisions, and performance considerations.\n"
                f"- Evaluate their ability to solve complex technical problems for a {role}.\n"
                "- Discuss system architecture, trade-offs, and company-specific tech stacks."
            )

        # ── Category-specific Phase 4/5/6 descriptions ──────────────────
        CATEGORY_PHASES = {
            "swe": {
                "p4_desc": "Project Deep-Dive (Identify exactly ONE strong project from candidate's resume, select exactly TWO specific achievements or bullet points from it, and ask candidate to explain the architecture, implementation details, and technical decisions behind those components).",
                "p5_desc": f"Low-Level Design (LLD) & API System Design (Ask the candidate to design it from a low-level perspective: defining API endpoints, database schemas, object-oriented class structure, and design patterns for: {system_design_scenario}).",
                "p6_desc": f"Real-life Domain of the Company's Solution (Present a highly realistic, domain-specific business problem and technical solution scenario based on the actual business model, products, or operations of {company} — e.g. for FAANG: global scaling, sub-millisecond latency, distributed systems; for Fintech: transactions integrity, compliance, fraud engines. Ask the candidate how they would design a solution using their role's expertise, focusing on practical constraints and technical trade-offs).",
            },
            "data_ai": {
                "p4_desc": "ML Project Deep-Dive (Identify exactly ONE ML/data project from candidate's resume. Ask about: the problem formulation, dataset size and features, model selection reasoning, training pipeline, evaluation metrics chosen, and how they handled overfitting or data quality issues).",
                "p5_desc": f"ML System Design (Ask the candidate to design an end-to-end ML system for: {system_design_scenario}. Cover: data ingestion, feature store, model training pipeline, serving infrastructure, monitoring for model drift, and feedback loops).",
                "p6_desc": f"Real-world ML Problem at {company} (Present a domain-specific ML challenge based on {company}'s actual business — e.g. for FAANG: recommendation systems, ad click prediction, search ranking; for Fintech: fraud detection models, credit scoring, anomaly detection. Ask the candidate to walk through the full ML lifecycle: problem framing, data collection, model choice, deployment, and monitoring).",
            },
            "infra_cloud": {
                "p4_desc": "Infrastructure Project Deep-Dive (Identify exactly ONE infra/DevOps/SRE project from candidate's resume. Ask about: the architecture decisions, how they handled high availability, monitoring setup, incident response experience, and any migrations or zero-downtime deployments they implemented).",
                "p5_desc": f"Cloud Architecture Design (Ask the candidate to design a secure, highly available cloud infrastructure for: {system_design_scenario}. Cover: load balancers, autoscaling groups, network routing, IaC, disaster recovery, and cost optimization).",
                "p6_desc": f"Real-world Infrastructure Challenge at {company} (Present a domain-specific infra problem based on {company}'s actual operations — e.g. for FAANG: global CDN, multi-region failover, petabyte-scale data pipelines; for Fintech: PCI-compliant infrastructure, real-time transaction processing, audit logging. Ask how they would architect the solution).",
            },
            "security": {
                "p4_desc": "Security Project Deep-Dive (Identify exactly ONE security project from candidate's resume. Ask about: the threat model they built, vulnerabilities they discovered, remediation steps taken, tools used (SIEM, scanners, burp suite), and how they measured improvement in security posture).",
                "p5_desc": f"Security Architecture Design (Ask the candidate to design a secure system structure for: {system_design_scenario}. Cover: threat modeling (STRIDE), authentication/authorization, data isolation, transit encryption, audit logging, and incident response plan).",
                "p6_desc": f"Real-world Security Challenge at {company} (Present a domain-specific security scenario based on {company}'s actual products — e.g. for FAANG: securing billion-user auth systems, DDoS mitigation, supply chain attacks; for Fintech: PCI-DSS compliance, fraud prevention, secure key management. Ask how they would approach the threat landscape).",
            },
            "product_design": {
                "p4_desc": "Product Project Deep-Dive (Identify exactly ONE product/project from candidate's resume. Ask about: the metrics they tracked, how they prioritized features, user research methodology used, stakeholder alignment challenges, and the outcome/impact of their decisions).",
                "p5_desc": f"Product Strategy & Growth Design (Ask the candidate to outline a product strategy for: {system_design_scenario}. Cover: target segment prioritization, monetization model, key metrics (North Star, activation, retention), A/B test design, and launch GTM strategy).",
                "p6_desc": f"Real-world Product Challenge at {company} (Present a domain-specific product scenario based on {company}'s actual business — e.g. for FAANG: growth loops, internationalization, platform ecosystem strategy; for Fintech: trust-building UX, regulatory constraints, conversion optimization. Ask how they would approach the product problem).",
            },
            "gaming": {
                "p4_desc": "Game Project Deep-Dive (Identify exactly ONE game project from candidate's resume. Ask about: the game loop architecture, rendering optimizations, physics implementation, multiplayer networking decisions, memory management strategies, and platform-specific constraints they handled).",
                "p5_desc": f"Game Architecture Design (Ask the candidate to design a game system architecture for: {system_design_scenario}. Cover: matchmaking queues, entity state sync, physics replication, asset loading optimization, and cross-platform considerations).",
                "p6_desc": f"Real-world Game Challenge at {company} (Present a domain-specific game engineering scenario — e.g. for AAA studios: open-world streaming, anti-cheat systems, cross-play matchmaking; for mobile: battery optimization, ad integration, live ops events. Ask how they would solve it).",
            },
            "specialized": {
                "p4_desc": "Domain Project Deep-Dive (Identify exactly ONE specialized project from candidate's resume. Ask about: the domain-specific challenges, technical constraints, integration decisions, testing methodology, and how they ensured reliability in their specialized domain).",
                "p5_desc": f"Specialized Architecture Design (Ask the candidate to design a specialized systems architecture for: {system_design_scenario}. Cover: domain-specific protocols, reliability requirements, scalability constraints, and integration with existing systems).",
                "p6_desc": f"Real-world Domain Challenge at {company} (Present a scenario based on {company}'s actual domain operations. Ask the candidate how they would apply their specialized expertise to solve a practical, real-world problem with concrete constraints).",
            },
        }

        cat_phases = CATEGORY_PHASES.get(category, CATEGORY_PHASES["swe"])

        if resume_summary:
            flow_phases = (
                f"Question 1 (Phase 1): Introduction & Background (Introduce yourself briefly — first name + role at {company}. Then welcome {candidate_name} warmly by name, confirm they are applying for the {role} role, and ask them to introduce themselves: 'Tell me about yourself' — name, background, education, key skills, professional experience, and projects. Do NOT dive into technical questions yet).\n"
                f"Question 2 (Phase 2): {p2_name} (Core Domain Fundamentals). You MUST ask a question specifically on one of these core subjects: {fundamental_focus}.\n"
                f"Question 3 (Phase 3): Fundamentals Deep-Dive & Edge Cases. Probe deeper into the previous concept, asking about edge cases, concurrency, memory, or architectural trade-offs.\n"
                f"Question 4 (Phase 4): {p3_desc}\n"
                f"Question 5 (Phase 5): Complexity & Scale Optimization. Ask the candidate to analyze the time and space complexity of their challenge solution and optimize it for high throughput or low memory.\n"
                f"Question 6 (Phase 6): {cat_phases['p4_desc']}\n"
                f"Question 7 (Phase 7): {cat_phases['p5_desc']}\n"
                f"Question 8 (Phase 8): High-Level System Architecture & Scale (Ask how to scale the design to millions of daily requests, covering distributed caching, sharding, and failover).\n"
                f"Question 9 (Phase 9): {cat_phases['p6_desc']}\n"
                "Question 10 (Phase 10): Closing & Candidate Q&A (Ask: 'That covers all my questions for today. Before we wrap up — do you have any questions for me about the team, tech stack, or the company?')"
            )
        else:
            flow_phases = (
                f"Question 1 (Phase 1): Introduction & Background (Introduce yourself briefly — first name + role at {company}. Then welcome {candidate_name} warmly by name, confirm they are applying for the {role} role, and ask them to introduce themselves: 'Tell me about yourself' — name, background, education, key skills, and projects. Do NOT dive into technical questions yet).\n"
                f"Question 2 (Phase 2): {p2_name} (Core Domain Fundamentals). You MUST ask a question specifically on one of these core subjects: {fundamental_focus}.\n"
                f"Question 3 (Phase 3): Fundamentals Deep-Dive & Edge Cases. Probe deeper into the previous concept, asking about edge cases, concurrency, memory, or architectural trade-offs.\n"
                f"Question 4 (Phase 4): {p3_desc}\n"
                f"Question 5 (Phase 5): Complexity & Scale Optimization. Ask the candidate to analyze the time and space complexity of their challenge solution and optimize it for high throughput or low memory.\n"
                f"Question 6 (Phase 6): {cat_phases['p4_desc']}\n"
                f"Question 7 (Phase 7): {cat_phases['p5_desc']}\n"
                f"Question 8 (Phase 8): High-Level System Architecture & Scale (Ask how to scale the design to millions of daily requests, covering distributed caching, sharding, and failover).\n"
                f"Question 9 (Phase 9): {cat_phases['p6_desc']}\n"
                "Question 10 (Phase 10): Closing & Candidate Q&A (Ask: 'That covers all my questions for today. Before we wrap up — do you have any questions for me about the team, tech stack, or the company?')"
            )
    else:
        mode_instructions = (
            "FOCUS: ONLY HR & BEHAVIORAL ASSESSMENT.\n"
            "- DYNAMIC DIFFICULTY: If the candidate is a fresher or college student, ask VERY SIMPLE, standard HR questions (e.g., 'Why do you want to work here?', 'Where do you see yourself in 5 years?'). If they are experienced, ask complex situational and leadership questions.\n"
            "- Evaluate communication, confidence, teamwork, and culture fit.\n"
            "- Keep the interview conversational and human-like.\n"
            "- Use STAR-based follow-up questions only for experienced candidates."
        )

        BEHAVIORAL_SCENARIOS_TEAMWORK = [
            "a time you had a major disagreement with a teammate or manager and how you resolved it",
            "a time you had to work with a difficult coworker or handle a team conflict",
            "a time you helped a teammate succeed or mentored someone on your team"
        ]
        BEHAVIORAL_SCENARIOS_CHALLENGES = [
            "a time you failed, made a major mistake, or missed a deadline, and what you learned from it",
            "a time you had to deliver under extremely tight timelines or high pressure",
            "a time you took a calculated risk or made a decision without complete information"
        ]
        
        behavioral_teamwork = local_random.choice(BEHAVIORAL_SCENARIOS_TEAMWORK)
        behavioral_challenge = local_random.choice(BEHAVIORAL_SCENARIOS_CHALLENGES)

        flow_phases = (
            "Question 1 (Phase 1): Introduction & Elevator Pitch — Tell me about yourself.\n"
            f"Question 2 (Phase 2): Motivation & Company Fit — Why {company}, and why this {role} position?\n"
            f"Question 3 (Phase 3): Core Competency & Key Strengths — Focus on: {fundamental_focus}.\n"
            f"Question 4 (Phase 4): Teamwork & Collaboration — Ask specifically about: {behavioral_teamwork}.\n"
            "Question 5 (Phase 5): Conflict Resolution — Disagreement over an engineering or design decision.\n"
            f"Question 6 (Phase 6): Handling Failure / Critical Mistakes — Ask specifically about: {behavioral_challenge}.\n"
            "Question 7 (Phase 7): High-Pressure Delivery & Tight Deadlines — Handling shifting requirements.\n"
            "Question 8 (Phase 8): Leadership, Mentorship & Ownership — Driving an ambiguous project.\n"
            "Question 9 (Phase 9): Career Aspirations, Work Culture & Relocation preferences.\n"
            "Question 10 (Phase 10): Closing & Candidate Q&A — 'Do you have any questions for me about the team or company?'"
        )

    resume_instruction = ""
    if interview_type == "technical" and resume_summary:
        resume_instruction = (
            f"\n\nCANDIDATE RESUME PROFILE & PROJECTS:\n"
            f"{resume_summary}\n\n"
            "INSTRUCTION: You must tailor the technical questions specifically to this candidate's resume, projects, experience, and background. "
            "Identify the candidate's current/target role and identify their key skills. "
            "Strictly filter their experience to distinguish professional/technical experience (like software engineering internships or full-time roles) from non-professional student/campus roles (such as campus ambassador, college club member, or class representative) - do NOT treat student activities/club memberships as professional technical experience. "
            "For project-related questions, identify exactly ONE strong project from their resume and select exactly TWO specific achievements/bullet points from it to ask about. "
            "Reference their specific details in your questions where relevant to make the mock interview feel highly realistic. "
            "Do not ask about skills they do not have unless exploring adjacent areas."
        )

    company_context = f"\nCOMPANY INTERVIEW STYLE & DOMAIN FOCUS: {company_style}" if company_style else ""

    return (
        f"You are a Senior Interviewer at {company} conducting a {interview_type.upper()} mock interview for a {role} role.\n\n"
        f"YOUR PERSONA: You behave as {interviewer_persona}.\n\n"
        f"INTERVIEW MODE: {interview_type.upper()}\n"
        f"TARGET COMPANY: {company} (Tier/Category: {company_tier}){company_context}\n"
        f"Difficulty: {difficulty_level}\n"
        f"Session Token: {seed_token}\n"
        f"INSTRUCTION: Ensure this session is fresh and highly customized. Ask unique, variant questions. Do not repeat typical template questions.\n\n"
        f"{mode_instructions}{resume_instruction}\n\n"
        "STRICT VOICE RULES:\n"
        "- No markdown, no bullet points, no emojis in your spoken responses.\n"
        "- Ask EXACTLY ONE question at a time. End your response with a single question mark (?). Never ask multiple questions.\n"
        "- Keep responses concise and natural (2-4 sentences max).\n"
        "- NEVER roleplay as the candidate. NEVER simulate a two-way dialogue.\n"
        "- Do NOT combine multiple phases. Ask the current phase's question and WAIT.\n\n"
        "ADAPTIVE QUESTIONING (INTELLIGENT RECURSION):\n"
        "- If the candidate gives a weak/wrong answer, ask a simpler follow-up or provide a gentle hint before moving on.\n"
        "- If the candidate gives a strong answer, dive deeper into constraints, edge cases, or optimization.\n\n"
        f"INTERVIEW FLOW (10 QUESTIONS TOTAL):\n{flow_phases}\n\n"
        "Remember: You are the interviewer. First provide a brief, direct review/feedback (1-2 sentences) evaluating the candidate's previous response, then ask the NEXT question, and then STOP."
    )


def build_scoring_rubric(role: str, interview_type: str = "technical", role_level: str = "fresher") -> str:
    """Rubric block shared by the legacy markdown feedback and the structured report.

    Single source of truth so the two feedback paths never drift from each other.
    """
    category = get_role_category(role)

    if interview_type == "technical":
        rubric_details = {
            "swe": "Flawless code logic, optimal space/time complexity, sound algorithm choice, and clean code structure.",
            "data_ai": "Strong statistical understanding, mathematically correct modeling assumptions, sound evaluation metrics choice, and pipeline scalability.",
            "infra_cloud": "Highly available cloud architecture design, correct container orchestration strategies, sound IaC practices, and network topology correctness.",
            "security": "Accurate threat modeling, zero-trust patterns, OWASP vulnerability mitigations, key exchange protocols correctness, and incident recovery logic.",
            "product_design": "Clear product metrics prioritization, correct roadmapping frameworks (RICE), accessibility (WCAG), and sound monetization/conversion strategies.",
            "gaming": "Frame-rate independence principles, sound collision checking algorithms, optimal netcode/lag compensation, and strict memory/GC allocation hygiene.",
        }.get(category, "Domain-specific protocol correctness, hardware/testing design compliance, and sound system integration methodology.")

        # Adjust scoring rubric based on role_level — freshers/interns get a lenient bar
        if role_level in ("intern", "fresher"):
            scoring_rubric = (
                f"- 90-100: Exceptional. Clear reasoning, solid fundamentals, attempted optimization, and {rubric_details}\n"
                f"- 75-89: Strong hire. Good problem-solving for their level, minor gaps in edge cases or optimization.\n"
                "- 50-74: Needs improvement. Struggled with core concepts, required significant hinting, or gave vague answers.\n"
                "- 0-49: Reject. Unable to articulate basic approach, fundamental misunderstandings, or poor communication.\n"
            )
        elif role_level == "mid":
            scoring_rubric = (
                f"- 90-100: Exceptional. Flawless logic, strong architectural understanding, and {rubric_details}\n"
                f"- 75-89: Strong hire. Good problem-solving, but missed minor edge cases, secondary trade-offs, or optimization details.\n"
                "- 50-74: Needs improvement. Required heavy hinting, struggled with core concepts, or gave superficial/vague answers.\n"
                "- 0-49: Reject. Failed to answer basic questions, completely wrong logic, or poor communication.\n"
            )
        else:  # senior
            scoring_rubric = (
                f"- 90-100: Exceptional. Flawless logic, deep architectural understanding, production-grade reasoning, and {rubric_details}\n"
                f"- 75-89: Strong hire. Good problem-solving, but missed edge cases, secondary trade-offs, or optimization details.\n"
                "- 50-74: Needs improvement. Required heavy hinting, struggled with core concepts, or gave superficial/vague answers.\n"
                "- 0-49: Reject. Failed to answer basic questions, completely wrong logic, or poor communication.\n"
            )
    else:
        # Behavioral scoring
        if role_level in ("intern", "fresher"):
            scoring_rubric = (
                "- 90-100: Exceptional. Clear, honest responses, good self-awareness, and genuine enthusiasm.\n"
                "- 75-89: Strong hire. Good answers, but lacked specific examples or stumbled slightly on some questions.\n"
                "- 50-74: Needs improvement. Vague answers, struggled to articulate experiences, or weak motivation.\n"
                "- 0-49: Reject. Poor communication, red flags in attitude, or failed to answer basic HR questions.\n"
            )
        else:
            scoring_rubric = (
                "- 90-100: Exceptional. Clear, structured STAR responses, high EQ, strong culture fit and leadership traits.\n"
                "- 75-89: Strong hire. Good answers, but lacked deep specific examples or stumbled slightly on conflict resolution.\n"
                "- 50-74: Needs improvement. Vague answers, struggled to articulate past experiences, or weak motivation.\n"
                "- 0-49: Reject. Poor attitude, red flags in teamwork/conflict, or failed to answer basic HR questions.\n"
            )

    return scoring_rubric


def _build_feedback_system_prompt(role: str, company: str, interview_type: str = "technical", role_level: str = "fresher") -> str:
    scoring_rubric = build_scoring_rubric(role, interview_type, role_level)

    return (
        f"You are a Senior Hiring Manager at {company}. Evaluate this {interview_type.upper()} interview transcript for a {role} position.\n\n"
        f"SCORING RUBRIC:\n{scoring_rubric}\n\n"
        "OUTPUT FORMAT — follow this EXACTLY. Do NOT repeat these instructions. Do NOT explain what you are doing. Just produce the feedback:\n\n"
        "That concludes our interview today. Thank you for your time. Here is your detailed performance analysis.\n\n"
        "**Executive Summary:** [One sentence summarizing performance]\n\n"
        "**Strengths:**\n"
        "- [Strength 1 — max 10 words]\n"
        "- [Strength 2 — max 10 words]\n\n"
        "**Areas of Improvement:**\n"
        "- [Gap 1 — max 10 words]\n"
        "- [Gap 2 — max 10 words]\n\n"
        "**Actionable Advice:**\n"
        "- [Study topic 1 — max 10 words]\n"
        "- [Study topic 2 — max 10 words]\n\n"
        "OVERALL SCORE : [X]/100"
    )
