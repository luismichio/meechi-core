export const TOOLS = [
    {
        type: "function",
        "function": {
            name: "update_file",
            description: "Update the content of an existing file. ONLY use this when the user explicitly asks to edit, modify, or append to a note. DO NOT use this spontaneously.",
            parameters: {
                type: "object",
                properties: {
                    filePath: {
                        type: "string",
                        description: "The path of the file to update.",
                    },
                    newContent: {
                        type: "string",
                        description: "The FULL new content of the file.",
                    },
                },
                required: ["filePath", "newContent"],
            },
        },
    },
    {
        type: "function",
        "function": {
            name: "create_file",
            description: "Create a new file. ONLY use this when the user explicitly provides content to save or asks to create a specific document. Never create files spontaneously for 'testing' or 'logging'.",
            parameters: {
                type: "object",
                properties: {
                    filePath: {
                        type: "string",
                        description: "The path for the new file.",
                    },
                    content: {
                        type: "string",
                        description: "The content of the new file.",
                    },
                },
                required: ["filePath", "content"],
            },
        },
    },
    {
        type: "function",
        "function": {
            name: "update_user_settings",
            description: "Update the user's Name or Tone. ONLY use this when the user explicitly asks to change their name or how the AI sounds. NEVER use this to 'guess' or 'set' a name based on general talk.",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "The user's preferred name."
                    },
                    tone: {
                        type: "string",
                        description: "The preferred tone for the AI."
                    }
                },
            },
        },
    },
    {
        type: "function",
        "function": {
            name: "move_file",
            description: "Move or rename a file. Use this to organize files into folders (Topics) or rename them.",
            parameters: {
                type: "object",
                properties: {
                    sourcePath: {
                        type: "string",
                        description: "The current path of the file (e.g. 'temp/myfile.pdf')."
                    },
                    destinationPath: {
                        type: "string",
                        description: "The new path for the file (e.g. 'misc/Work/myfile.pdf')."
                    }
                },
                required: ["sourcePath", "destinationPath"]
            }
        }
    },
    {
        type: "function",
        "function": {
            name: "fetch_url",
            description: "Fetch content from a URL to save as a source. Use this when the user shares a link.",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "The URL to fetch."
                    },
                    destinationPath: {
                        type: "string",
                        description: "The path to save the source to (e.g. 'misc/Research/source.md')."
                    }
                },
                required: ["url", "destinationPath"]
            }
        }
    }
];
