import sys
content = open("src/api/main.py", encoding="utf-8").read()

# The else: is orphaned. Move it before the UFC registration.
old = """        except Exception as e:
            logger.warning(f"[!!] Impossible de charger le modele tennis: {e}")

    # ---- UFC/MMA registration ----
    ufc_pipeline = UFCPipeline(min_fights_per_fighter=3)
    MODEL_REGISTRY.register("ufc", ModelEntry(
        sport="ufc",
        pipeline=ufc_pipeline,
        model=UfcBaselineModel(),
        feature_columns=["ewma_strike_diff_S", "ewma_td_diff_S", "true_talent_a"],
        model_loaded=True,
        model_version="pariscore-ufc-v0.1",
        loaded_at=datetime.utcnow(),
    ))
    logger.info("[OK] Modele UFC enregistre (baseline EWMA)")
    else:
        logger.info("[i] Aucun modele tennis trouve.")
    logger.info("[i] API Pariscore v1.1.0 prete")"""

new = """        except Exception as e:
            logger.warning(f"[!!] Impossible de charger le modele tennis: {e}")
    else:
        logger.info("[i] Aucun modele tennis trouve.")

    # ---- UFC/MMA registration ----
    ufc_pipeline = UFCPipeline(min_fights_per_fighter=3)
    MODEL_REGISTRY.register("ufc", ModelEntry(
        sport="ufc",
        pipeline=ufc_pipeline,
        model=UfcBaselineModel(),
        feature_columns=["ewma_strike_diff_S", "ewma_td_diff_S", "true_talent_a"],
        model_loaded=True,
        model_version="pariscore-ufc-v0.1",
        loaded_at=datetime.utcnow(),
    ))
    logger.info("[OK] Modele UFC enregistre (baseline EWMA)")
    logger.info("[i] API Pariscore v1.1.0 prete")"""

assert old in content, "Pattern not found!"
content = content.replace(old, new, 1)
open("src/api/main.py", "w", encoding="utf-8").write(content)
print("OK: else moved, structure fixed")
