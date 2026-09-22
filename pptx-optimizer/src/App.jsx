import { useState } from "react";

import { decodePptx } from "./pptx/pptxDecoder";

import {
  repackPptx,
  downloadPptx,
} from "./pptx/pptxRepacker";

import "./App.css";


function App() {
  const [processing, setProcessing] = useState(false);
  const [repacking, setRepacking] = useState(false);

  const [progress, setProgress] = useState(null);
  const [stage, setStage] = useState("");

  const [result, setResult] = useState(null);
  const [optimizedPptx, setOptimizedPptx] = useState(null);

  const [originalFileName, setOriginalFileName] =
    useState("presentation.pptx");

  const [error, setError] = useState(null);


  // =========================================================
  // SELECT PPTX
  // =========================================================

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    console.log("Selected file:", file.name);

    setOriginalFileName(file.name);

    setProcessing(true);
    setRepacking(false);

    setProgress(null);
    setStage("Opening presentation...");

    setResult(null);
    setOptimizedPptx(null);
    setError(null);


    try {
      const analysis = await decodePptx(file, {

        // -----------------------------------------------------
        // STAGE
        // -----------------------------------------------------

        onStageChange: (stageInfo) => {
          console.log("[Stage]", stageInfo);

          setStage(
            stageInfo.message || ""
          );

          if (stageInfo.total != null) {
            setProgress({
              completed:
                stageInfo.completed || 0,

              total:
                stageInfo.total,

              percentage:
                stageInfo.percentage || 0,
            });
          }
        },


        // -----------------------------------------------------
        // OPTIMIZATION PROGRESS
        // -----------------------------------------------------

        onProgress: (progressInfo) => {
          setProgress({
            completed:
              progressInfo.completed,

            total:
              progressInfo.total,

            percentage:
              progressInfo.percentage,
          });

          setStage(
            `Optimizing ${progressInfo.completed} of ${progressInfo.total} images`
          );
        },
      });


      console.log(
        "PPTX analysis complete:",
        analysis
      );

      setResult(analysis);

      setStage(
        "Optimization complete"
      );

    } catch (processingError) {

      console.error(
        "PPTX processing failed:",
        processingError
      );

      setError(
        processingError instanceof Error
          ? processingError.message
          : String(processingError)
      );

      setStage(
        "Processing failed"
      );

    } finally {
      setProcessing(false);
    }
  }


  // =========================================================
  // REPACK PPTX
  // =========================================================

  async function handleRepack() {

    if (!result?.zip) {
      setError(
        "The optimized presentation data is not available."
      );

      return;
    }

    if (
      !Array.isArray(
        result.optimizationResults
      )
    ) {
      setError(
        "No optimization results are available to repack."
      );

      return;
    }

    setRepacking(true);
    setError(null);
    setOptimizedPptx(null);

    setStage(
      "Creating optimized presentation..."
    );

    setProgress({
      completed: 0,
      total: 100,
      percentage: 0,
    });


    try {

      console.log(
        "Starting PPTX repack..."
      );

      console.log(
        "Optimization results:",
        result.optimizationResults
      );


      const optimizedFile =
        await repackPptx(
          result.zip,
          result.optimizationResults,
          {
            originalFileName,

            onProgress: (progressInfo) => {

              if (
                progressInfo.stage ===
                "repacking"
              ) {
                setStage(
                  progressInfo.currentFile
                    ? `Rebuilding ${progressInfo.currentFile}`
                    : "Rebuilding presentation..."
                );
              } else {
                setStage(
                  "Replacing optimized media..."
                );
              }

              setProgress({
                completed:
                  progressInfo.completed,

                total:
                  progressInfo.total,

                percentage:
                  progressInfo.percentage,
              });
            },
          }
        );


      console.log(
        "Optimized PPTX created:",
        optimizedFile
      );


      setOptimizedPptx(
        optimizedFile
      );

      setProgress({
        completed: 100,
        total: 100,
        percentage: 100,
      });

      setStage(
        "Optimized presentation ready"
      );

    } catch (repackError) {

      console.error(
        "PPTX repack failed:",
        repackError
      );

      setError(
        repackError instanceof Error
          ? repackError.message
          : String(repackError)
      );

      setStage(
        "Could not create optimized presentation"
      );

    } finally {
      setRepacking(false);
    }
  }


  // =========================================================
  // DOWNLOAD
  // =========================================================

  function handleDownload() {

    if (!optimizedPptx) {
      return;
    }

    try {

      console.log(
        "Downloading:",
        optimizedPptx.name
      );

      downloadPptx(
        optimizedPptx
      );

    } catch (downloadError) {

      console.error(
        "PPTX download failed:",
        downloadError
      );

      setError(
        downloadError instanceof Error
          ? downloadError.message
          : String(downloadError)
      );
    }
  }


  const summary =
    result?.optimizationSummary;


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="optimizer-page">

      <div className="optimizer-shell">


        {/* ===================================================
            HEADER
        =================================================== */}

        <header className="optimizer-header">

          <div className="brand-lockup">

            <div className="brand-mark">
              Z
            </div>

            <div className="brand-wordmark">
              ZOOMIFIER
            </div>

          </div>


          <div className="header-divider" />


          <div className="product-name">
            PPTX Media Optimizer
          </div>

        </header>


        {/* ===================================================
            INTRO
        =================================================== */}

        {!processing && !result && (

          <section className="intro-section">

            <div className="intro-copy">

              <span className="section-eyebrow">
                MEDIA OPTIMIZATION
              </span>

              <h1>
                Optimize your presentation
              </h1>

              <p>
                Reduce the size of presentation media
                while keeping your original PowerPoint
                unchanged.
              </p>

            </div>


            {/* UPLOAD */}

            <div className="upload-card">

              <div className="upload-icon">
                <span>↑</span>
              </div>


              <h2>
                Select a PowerPoint presentation
              </h2>


              <p>
                We'll scan the presentation, identify
                optimization opportunities and process
                eligible images.
              </p>


              <label className="button button-gradient">

                Choose PPTX

                <input
                  type="file"
                  accept=".pptx"
                  onChange={
                    handleFileChange
                  }
                  disabled={
                    processing ||
                    repacking
                  }
                />

              </label>


              <span className="upload-hint">
                Supported format: PPTX
              </span>

            </div>

          </section>

        )}


        {/* ===================================================
            PROCESSING
        =================================================== */}

        {(processing || repacking) && (

          <section className="processing-card">

            <div className="processing-top">

              <div>

                <span className="section-eyebrow">
                  {repacking
                    ? "CREATING PRESENTATION"
                    : "PROCESSING PRESENTATION"}
                </span>

                <h2>
                  {stage}
                </h2>

              </div>


              {progress && (

                <strong className="progress-value">
                  {Math.round(
                    progress.percentage
                  )}%
                </strong>

              )}

            </div>


            {progress && (

              <div className="progress-container">

                <div className="progress-meta">

                  <span>
                    {Math.round(
                      progress.completed
                    )} of{" "}
                    {Math.round(
                      progress.total
                    )}
                  </span>

                  <span>
                    {repacking
                      ? "Rebuilding"
                      : "Images"}
                  </span>

                </div>


                <div className="progress-track">

                  <div
                    className="progress-fill"
                    style={{
                      width:
                        `${progress.percentage}%`,
                    }}
                  />

                </div>

              </div>

            )}


            {!progress && (

              <div className="progress-track">

                <div className="progress-fill progress-indeterminate" />

              </div>

            )}


            <p className="processing-note">

              {repacking
                ? "We're rebuilding the presentation with the optimized media. Your original file remains unchanged."
                : "Your presentation is being processed locally. The original file remains unchanged."}

            </p>

          </section>

        )}


        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (

          <section className="error-message">

            <div className="error-symbol">
              !
            </div>

            <div>

              <strong>
                Something went wrong
              </strong>

              <p>
                {error}
              </p>

            </div>

          </section>

        )}


        {/* ===================================================
            RESULTS
        =================================================== */}

        {result && summary && (

          <section className="results-section">


            {/* RESULT HEADER */}

            <div className="result-heading">

              <div>

                <span className="section-eyebrow success">
                  {optimizedPptx
                    ? "PRESENTATION READY"
                    : "OPTIMIZATION COMPLETE"}
                </span>

                <h1>
                  {optimizedPptx
                    ? "Your optimized presentation is ready"
                    : "Presentation analysis"}
                </h1>

                <p>
                  {optimizedPptx
                    ? "The optimized media has been repacked into a new PowerPoint presentation."
                    : "Here's what we found and optimized in your presentation."}
                </p>

              </div>

            </div>


            {/* OVERVIEW */}

            <div className="stats-grid">

              <StatCard
                label="Total media"
                value={
                  result.mediaFiles.length
                }
              />

              <StatCard
                label="Images"
                value={
                  result.imageFiles.length
                }
              />

              <StatCard
                label="Videos"
                value={
                  result.videoFiles.length
                }
              />

              <StatCard
                label="Optimization candidates"
                value={
                  summary.candidates
                }
                accent
              />

            </div>


            {/* OPTIMIZATION SUMMARY */}

            <div className="summary-card">

              <div className="card-heading">

                <div>

                  <span className="section-eyebrow">
                    OPTIMIZATION SUMMARY
                  </span>

                  <h2>
                    Media optimization results
                  </h2>

                </div>


                <div className="saving-display">

                  <strong>
                    {summary.savingsPercentage.toFixed(
                      1
                    )}%
                  </strong>

                  <span>
                    saved
                  </span>

                </div>

              </div>


              <div className="summary-stats">

                <SummaryStat
                  label="Successful"
                  value={
                    summary.successful
                  }
                />

                <SummaryStat
                  label="Improved"
                  value={
                    summary.improved
                  }
                />

                <SummaryStat
                  label="Unchanged"
                  value={
                    summary.unchanged
                  }
                />

                <SummaryStat
                  label="Failed"
                  value={
                    summary.failed
                  }
                />

              </div>


              <div className="size-row">

                <div className="size-item">

                  <span>
                    Original size
                  </span>

                  <strong>
                    {formatBytes(
                      summary.originalBytes
                    )}
                  </strong>

                </div>


                <div className="size-arrow">
                  →
                </div>


                <div className="size-item">

                  <span>
                    Optimized size
                  </span>

                  <strong>
                    {formatBytes(
                      summary.optimizedBytes
                    )}
                  </strong>

                </div>


                <div className="saved-item">

                  <span>
                    Space saved
                  </span>

                  <strong>
                    {formatBytes(
                      summary.bytesSaved
                    )}
                  </strong>

                </div>

              </div>


              <div className="processing-time">

                Processing time:{" "}

                {formatDuration(
                  summary.totalProcessingTimeMs
                )}

              </div>

            </div>


            {/* =================================================
                CREATE / DOWNLOAD
            ================================================= */}

            <div className="next-action">

              <div className="next-action-copy">

                <span className="section-eyebrow">
                  NEXT STEP
                </span>


                {!optimizedPptx ? (

                  <>

                    <h2>
                      Create the optimized presentation
                    </h2>

                    <p>
                      The optimized media is ready.
                      Create a new PowerPoint with the
                      optimized files while preserving
                      the original presentation.
                    </p>

                  </>

                ) : (

                  <>

                    <h2>
                      Your optimized presentation is ready
                    </h2>

                    <p>
                      The presentation has been
                      successfully rebuilt with the
                      optimized media.
                    </p>

                  </>

                )}

              </div>


              {!optimizedPptx ? (

                <button
                  className="button button-gradient"
                  onClick={
                    handleRepack
                  }
                  disabled={
                    repacking
                  }
                >

                  {repacking
                    ? "Creating..."
                    : "Create optimized PPTX"}

                </button>

              ) : (

                <button
                  className="button button-gradient"
                  onClick={
                    handleDownload
                  }
                >
                  Download optimized PPTX
                </button>

              )}

            </div>


          </section>

        )}

      </div>

    </main>
  );
}


// =========================================================
// SMALL COMPONENTS
// =========================================================

function StatCard({
  label,
  value,
  accent = false,
}) {

  return (
    <div
      className={
        `stat-card ${
          accent
            ? "stat-card-accent"
            : ""
        }`
      }
    >

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


function SummaryStat({
  label,
  value,
}) {

  return (
    <div className="summary-stat">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


// =========================================================
// HELPERS
// =========================================================

function formatBytes(bytes) {

  if (!bytes) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(bytes) /
        Math.log(1024)
      ),
      units.length - 1
    );

  const value =
    bytes /
    Math.pow(
      1024,
      index
    );

  return `${value.toFixed(2)} ${
    units[index]
  }`;
}


function formatDuration(ms) {

  if (!ms) {
    return "0 ms";
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  return `${(
    ms / 1000
  ).toFixed(1)} sec`;
}


export default App;