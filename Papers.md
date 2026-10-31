Searchable Symmetric Encryption — Curtmola et al. (2006)	Enable efficient keyword searches over encrypted data using secure search structures, with formal security guarantees.	Our searchable-encryption module extracts and normalizes document keywords and builds a searchable index linked to documents. This follows the indexed-search idea, but we have not established that our implementation satisfies the paper’s formal security guarantees.



Practical Techniques for Searches on Encrypted Data — Song et al. (2000)	Allow a server to search encrypted documents without needing to read their entire plaintext.	This motivates our search by keyword while documents remain encrypted in storage. It is a conceptual reference rather than a claim that we implemented their exact construction.


Cryptographic Cloud Storage — Kamara & Lauter (2010)	Protect outsourced data while preserving useful operations such as search and controlled access.	Our AES-GCM document encryption, RSA-wrapped document keys, sharing controls, and keyword search address this broader goal. However, our backend can decrypt documents, so we still trust the application server.


Role-Based Access Control Models — Sandhu et al. (1996)	Simplify authorization by assigning permissions to roles and assigning users to those roles.	Our role and permission tables, together with backend authorization checks, implement the basic RBAC concept. Document ownership and sharing permissions provide additional access checks.



RAD-AA Framework — Singh et al. (2022 preprint)	Adapt authentication and authorization decisions according to risk scores and trust information.	Our six-factor adaptive risk engine follows this principle by considering contextual risk alongside ordinary permissions. Our particular factors, weights, and thresholds are project-specific choices.


Secure Audit Logs — Schneier & Kelsey (1999)	Make manipulation of earlier audit records detectable, even after the logging machine is compromised.	Our audit logging supports accountability by recording actions. Implementing the paper’s stronger protection would require additional mechanisms such as authenticated chaining and protected checkpoints; ordinary database logs alone do not provide